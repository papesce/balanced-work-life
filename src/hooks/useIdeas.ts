"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { usePendingOverrides } from "./usePendingOverrides";
import { Idea, IdeaNode } from "@/lib/types";
import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { getToday, getWindowRange } from "@/lib/dateUtils";
import { appendStatusHistory } from "@/lib/statusHistory";
import { ideaInsertSql, ideaInsertParams } from "@/lib/ideaInsert";
import {
  STORAGE_KEYS,
  TreeOverrideState,
  readTreeOverrides,
  writeTreeOverrides,
} from "@/lib/storage";

const DEFAULT_EXPAND_DEPTH = 1;

export type IdeasScope = "all" | "this_month";
/**
 * Where a newly created idea lands among its siblings:
 * - "top"/"bottom": absolute start/end of the sibling list
 * - { beforeId } / { afterId }: directly before/after the anchor sibling
 */
export type CreateIdeaPosition = "top" | "bottom" | { beforeId: string } | { afterId: string };
type OverrideState = TreeOverrideState;

function getDepthMap(ideas: Idea[]): Map<string, number> {
  const depths = new Map<string, number>();
  const childrenOf = new Map<string | null, string[]>();
  for (const idea of ideas) {
    const parentKey = idea.parent_id ?? null;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(idea.id);
  }
  const walk = (id: string, depth: number) => {
    depths.set(id, depth);
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1);
  };
  for (const rootId of childrenOf.get(null) ?? []) walk(rootId, 0);
  return depths;
}

function computeCollapsedIds(
  ideas: Idea[],
  overrides: Map<string, OverrideState>,
  search = "",
): Set<string> {
  const depths = getDepthMap(ideas);
  const collapsed = new Set<string>();
  const parents = new Set(
    ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
  );
  const hasSearch = search.trim().length > 0;

  const nodeHasSearchMatch = (ideaId: string): boolean => {
    const idea = ideas.find((i) => i.id === ideaId);
    if (!idea) return false;
    const q = search.toLowerCase();
    if (idea.text.toLowerCase().includes(q)) return true;
    if (idea.notes?.toLowerCase().includes(q)) return true;
    if (idea.why?.toLowerCase().includes(q)) return true;
    return ideas.some((child) => child.parent_id === ideaId && nodeHasSearchMatch(child.id));
  };

  for (const id of parents) {
    const depth = depths.get(id) ?? 0;
    const override = overrides.get(id);
    if (override === "expanded") continue;
    if (hasSearch && nodeHasSearchMatch(id)) continue;
    if (override === "collapsed" || depth >= DEFAULT_EXPAND_DEPTH) {
      collapsed.add(id);
    }
  }
  return collapsed;
}

function compareIdeasForTree(a: Idea, b: Idea): number {
  const aDone = a.completed_at || a.status === "missed" ? 1 : 0;
  const bDone = b.completed_at || b.status === "missed" ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  return a.sort_order - b.sort_order;
}

function buildTree(ideas: Idea[], collapsedIds: Set<string>): IdeaNode[] {
  return buildTreeGeneric(ideas, collapsedIds, compareIdeasForTree);
}

function sortIdeasForInsert(ideas: Idea[]): Idea[] {
  const byId = new Map(ideas.map((idea) => [idea.id, idea]));
  const depthOf = (idea: Idea): number => {
    let depth = 0;
    let current = idea;
    while (current.parent_id && byId.has(current.parent_id)) {
      depth += 1;
      current = byId.get(current.parent_id)!;
    }
    return depth;
  };

  return [...ideas].sort((a, b) => depthOf(a) - depthOf(b));
}

/** PowerSync stores JSON columns as text — deserialize them back to the expected JS types. */
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    let parsed: unknown = JSON.parse(value);
    // Unwrap double-encoding from legacy uploads that stored a JSON string
    // ('"[\\"2026-..\\"]"') instead of an array in the server jsonb column.
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseStatusHistory(value: unknown): { status: Idea["status"]; at: string }[] | null {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) return value as { status: Idea["status"]; at: string }[];
  if (typeof value !== "string") return null;
  try {
    let parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return null;
      }
    }
    return Array.isArray(parsed) ? (parsed as { status: Idea["status"]; at: string }[]) : null;
  } catch {
    return null;
  }
}

function deserializeIdea(row: Record<string, unknown>): Idea {
  return {
    ...row,
    why: (row.why as string | null) ?? null,
    is_priority: Boolean(row.is_priority),
    attempt_dates: parseStringArray(row.attempt_dates),
    status_history: parseStatusHistory(row.status_history),
  } as unknown as Idea;
}

function buildScopedQuery(userId: string, scope: IdeasScope): { sql: string; params: string[] } {
  if (scope === "this_month") {
    const { start, end } = getWindowRange("month", getToday());
    return {
      sql: `SELECT * FROM ideas WHERE user_id = ?
            AND (
              (scheduled_date >= ? AND scheduled_date <= ?)
              OR (scheduled_date IS NULL AND status NOT IN ('completed','cancelled','missed','archived'))
            )
            ORDER BY sort_order ASC`,
      params: [userId, start, end],
    };
  }
  return {
    sql: `SELECT * FROM ideas WHERE user_id = ? ORDER BY sort_order ASC`,
    params: [userId],
  };
}

export function useIdeas(options: { scope?: IdeasScope; searchQuery?: string } = {}) {
  const { scope = "all", searchQuery = "" } = options;
  const { user } = useAuth();
  const db = usePowerSync();

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const overridesRef = useRef<Map<string, OverrideState>>(new Map());

  useEffect(() => {
    overridesRef.current = readTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides);
  }, []);

  const userId = user?.id ?? "";
  const hasSearch = searchQuery.trim().length > 0;
  // While searching, look at every idea regardless of the active time scope.
  const { sql, params } = buildScopedQuery(userId, hasSearch ? "all" : scope);

  const { data: rawRows, isLoading: loading } = useQuery<Record<string, unknown>>(
    userId ? sql : "SELECT * FROM ideas WHERE 0",
    userId ? params : [],
  );

  // Optimistic overlay: applied synchronously in updateIdea so status
  // toggles render instantly instead of waiting for the live query.
  const {
    overrides: pendingIdeas,
    setOverride: setPendingIdea,
    removeOverride: removePendingIdea,
    removeOverridesWhere: removePendingIdeasWhere,
  } = usePendingOverrides<string, Partial<Idea>>();

  const ideas: Idea[] = useMemo(() => {
    const base = rawRows.map(deserializeIdea);
    if (pendingIdeas.size === 0) return base;
    return base.map((idea) => {
      const patch = pendingIdeas.get(idea.id);
      return patch ? { ...idea, ...patch } : idea;
    });
  }, [rawRows, pendingIdeas]);

  useEffect(() => {
    if (ideas.length === 0) return;
    setCollapsedIds(computeCollapsedIds(ideas, overridesRef.current, searchQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, searchQuery]);

  // Drop optimistic patches once the live query has converged on them.
  useEffect(() => {
    if (pendingIdeas.size === 0 || rawRows.length === 0) return;
    const liveById = new Map(rawRows.map((r) => [r.id as string, deserializeIdea(r)]));
    removePendingIdeasWhere((id, patch) => {
      const live = liveById.get(id);
      if (!live) return false;
      return (Object.keys(patch) as (keyof Idea)[]).every((key) => {
        const pendingValue = patch[key];
        const liveValue = live[key];
        if (Array.isArray(pendingValue) || Array.isArray(liveValue)) {
          return JSON.stringify(pendingValue ?? null) === JSON.stringify(liveValue ?? null);
        }
        return (pendingValue ?? null) === (liveValue ?? null);
      });
    });
  }, [rawRows, pendingIdeas.size, removePendingIdeasWhere]);

  const createIdea = async (
    text: string,
    parentId: string | null = null,
    position: CreateIdeaPosition = "bottom",
    initialUpdates: Partial<Idea> = {},
  ): Promise<string> => {
    if (!user) return "";
    const siblings = ideas.filter((i) => i.parent_id === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) : -1;
    const now = new Date().toISOString();
    const id = uuidv4();

    let sortOrder: number;
    if (position === "top") {
      sortOrder = 0;
    } else if (position === "bottom") {
      sortOrder = maxOrder + 1;
    } else {
      // Anchored insert; fall back to append when the anchor isn't a sibling
      // (e.g. stale UI state after the anchor was deleted or moved).
      const anchorId = "beforeId" in position ? position.beforeId : position.afterId;
      const anchor = siblings.find((s) => s.id === anchorId);
      sortOrder = anchor ? anchor.sort_order + ("afterId" in position ? 1 : 0) : maxOrder + 1;
    }

    const reorderedSiblings =
      position === "top"
        ? siblings.map((s) => ({ ...s, sort_order: s.sort_order + 1 }))
        : typeof position === "object"
          ? siblings
              .filter((s) => s.sort_order >= sortOrder)
              .map((s) => ({ ...s, sort_order: s.sort_order + 1 }))
          : [];
    const idea: Idea = {
      id,
      user_id: user.id,
      parent_id: parentId,
      text,
      description: null,
      type: null,
      effort: null,
      impact: null,
      urgency: null,
      scheduled_date: null,
      scheduled_time: null,
      duration_minutes: null,
      is_priority: false,
      priority_order: null,
      status: "draft",
      notes: null,
      why: null,
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
      attempt_dates: [],
      status_history: null,
      productivity_signal: null,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
      ...initialUpdates,
    };
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        ideaInsertSql(),
        ideaInsertParams({
          id: idea.id,
          user_id: idea.user_id,
          parent_id: idea.parent_id,
          text: idea.text,
          description: idea.description,
          type: idea.type,
          effort: idea.effort,
          impact: idea.impact,
          urgency: idea.urgency,
          scheduled_date: idea.scheduled_date,
          scheduled_time: idea.scheduled_time,
          duration_minutes: idea.duration_minutes,
          is_priority: idea.is_priority,
          priority_order: idea.priority_order,
          status: idea.status,
          notes: idea.notes,
          why: idea.why ?? null,
          completed_at: idea.completed_at,
          cancelled_at: idea.cancelled_at,
          paused_at: idea.paused_at,
          attempt_dates: idea.attempt_dates,
          status_history: idea.status_history,
          productivity_signal: idea.productivity_signal ?? null,
          sort_order: idea.sort_order,
          created_at: idea.created_at,
          updated_at: idea.updated_at,
        }),
      );
      for (const sibling of reorderedSiblings) {
        await tx.execute(`UPDATE ideas SET sort_order = ?, updated_at = ? WHERE id = ?`, [
          sibling.sort_order,
          now,
          sibling.id,
        ]);
      }
    });
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const updatedAt = new Date().toISOString();
    const previous = ideas.find((i) => i.id === id);

    const finalUpdates = { ...updates } as Partial<Idea>;
    if (updates.status && previous && updates.status !== previous.status) {
      finalUpdates.status_history = appendStatusHistory(previous, updates.status);
    }

    const fields = Object.keys(finalUpdates);
    if (fields.length === 0) return;

    // Instant UI: merge patch over the live row before touching SQLite.
    const prevPending = pendingIdeas.get(id);
    setPendingIdea(id, { ...prevPending, ...finalUpdates });

    const setClauses = [...fields, "updated_at"].map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => {
      const v = finalUpdates[f as keyof Idea];
      if (f === "attempt_dates") return JSON.stringify(v ?? []);
      if (f === "status_history") return v ? JSON.stringify(v) : null;
      if (f === "is_priority") return v ? 1 : 0;
      return v ?? null;
    });
    values.push(updatedAt);

    try {
      await db.execute(`UPDATE ideas SET ${setClauses} WHERE id = ?`, [...values, id]);
    } catch (e) {
      if (prevPending) setPendingIdea(id, prevPending);
      else removePendingIdea(id);
      throw e;
    }
  };

  const deleteIdea = async (id: string) => {
    const toDelete = new Set<string>();
    const collect = (nodeId: string) => {
      toDelete.add(nodeId);
      ideas.filter((i) => i.parent_id === nodeId).forEach((child) => collect(child.id));
    };
    collect(id);
    await db.writeTransaction(async (tx) => {
      for (const ideaId of toDelete) {
        await tx.execute(`DELETE FROM ideas WHERE id = ?`, [ideaId]);
      }
    });
  };

  const restoreIdeas = async (restoredIdeas: Idea[]) => {
    if (restoredIdeas.length === 0) return;
    const orderedIdeas = sortIdeasForInsert(restoredIdeas);
    await db.writeTransaction(async (tx) => {
      for (const idea of orderedIdeas) {
        await tx.execute(
          `INSERT OR REPLACE INTO ideas (id, user_id, parent_id, text, description, type, effort, impact, urgency,
            scheduled_date, scheduled_time, duration_minutes, is_priority, priority_order,
            status, notes, why, completed_at, cancelled_at, paused_at, attempt_dates, status_history,
            productivity_signal, sort_order, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            idea.id,
            idea.user_id,
            idea.parent_id,
            idea.text,
            idea.description,
            idea.type,
            idea.effort,
            idea.impact,
            idea.urgency,
            idea.scheduled_date,
            idea.scheduled_time,
            idea.duration_minutes,
            idea.is_priority ? 1 : 0,
            idea.priority_order,
            idea.status,
            idea.notes,
            idea.why ?? null,
            idea.completed_at,
            idea.cancelled_at,
            idea.paused_at,
            JSON.stringify(idea.attempt_dates),
            idea.status_history ? JSON.stringify(idea.status_history) : null,
            idea.productivity_signal ?? null,
            idea.sort_order,
            idea.created_at,
            idea.updated_at,
          ],
        );
      }
    });
  };

  const reorderTasks = useCallback(
    async (taskIds: string[]) => {
      const updatedAt = new Date().toISOString();
      await db.writeTransaction(async (tx) => {
        for (let i = 0; i < taskIds.length; i++) {
          await tx.execute(`UPDATE ideas SET sort_order = ?, updated_at = ? WHERE id = ?`, [
            i,
            updatedAt,
            taskIds[i],
          ]);
        }
      });
    },
    [db],
  );

  const smartSortTasks = useCallback(
    async (tasksInGroup: Idea[], priorityRankOf?: (ideaId: string) => number) => {
      const computeScore = (t: Idea): number => {
        const urgency = t.urgency ?? 3;
        const impact = t.impact ?? 3;
        const effort = t.effort ?? 3;
        const rank = priorityRankOf?.(t.id) ?? 3;
        const priorityBoost = rank === 0 ? 2.5 : rank === 1 ? 1.75 : rank === 2 ? 1.25 : 1;
        return (priorityBoost * (urgency * impact)) / Math.max(effort, 1);
      };

      const sorted = [...tasksInGroup].sort((a, b) => {
        const diff = computeScore(b) - computeScore(a);
        return diff !== 0 ? diff : a.sort_order - b.sort_order;
      });

      await reorderTasks(sorted.map((t) => t.id));
    },
    [reorderTasks],
  );

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const updatedAt = new Date().toISOString();
    const siblings = ideas.filter((i) => i.parent_id === newParentId && i.id !== id);
    const previousOrders = new Map(ideas.map((i) => [i.id, i.sort_order]));
    const reordered = siblings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s, idx) => ({
        ...s,
        sort_order: idx >= newSortOrder ? idx + 1 : idx,
      }));

    await db.writeTransaction(async (tx) => {
      await tx.execute(
        `UPDATE ideas SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
        [newParentId, newSortOrder, updatedAt, id],
      );

      for (const sibling of reordered) {
        if (sibling.sort_order === previousOrders.get(sibling.id)) continue;
        await tx.execute(`UPDATE ideas SET sort_order = ?, updated_at = ? WHERE id = ?`, [
          sibling.sort_order,
          updatedAt,
          sibling.id,
        ]);
      }
    });
  };

  /**
   * Create a new root parent and move `movedId` under it in a single
   * write transaction, so a partial state (parent created, child not
   * moved) can't sync. Reuses the shared idea-insert column list.
   * Returns the new parent id ("" when there's no user).
   */
  const createParentAndMove = async (
    movedId: string,
    parentText: string,
    parentType: Idea["type"],
  ): Promise<string> => {
    if (!user) return "";
    const text = parentText.trim();
    if (!text) return "";
    const now = new Date().toISOString();
    const parentId = uuidv4();
    const rootSiblings = ideas.filter((i) => i.parent_id === null);
    const maxOrder =
      rootSiblings.length > 0 ? Math.max(...rootSiblings.map((s) => s.sort_order)) : -1;

    await db.writeTransaction(async (tx) => {
      await tx.execute(
        ideaInsertSql(),
        ideaInsertParams({
          id: parentId,
          user_id: user.id,
          parent_id: null,
          text,
          description: null,
          type: parentType,
          effort: null,
          impact: null,
          urgency: null,
          scheduled_date: null,
          scheduled_time: null,
          duration_minutes: null,
          is_priority: false,
          priority_order: null,
          status: "draft",
          notes: null,
          why: null,
          completed_at: null,
          cancelled_at: null,
          paused_at: null,
          attempt_dates: [],
          status_history: null,
          productivity_signal: null,
          sort_order: maxOrder + 1,
          created_at: now,
          updated_at: now,
        }),
      );
      await tx.execute(
        `UPDATE ideas SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
        [parentId, 0, now, movedId],
      );
    });
    return parentId;
  };

  const markDone = async (id: string) => {
    const now = new Date().toISOString();
    await updateIdea(id, {
      status: "completed",
      completed_at: now,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markUndone = async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    const fallbackStatus = idea?.scheduled_date
      ? idea?.scheduled_time
        ? "scheduled"
        : "planned"
      : "draft";
    await updateIdea(id, {
      status: fallbackStatus,
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markInProgress = async (id: string) => {
    await updateIdea(id, {
      status: "in_progress",
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markPaused = async (id: string) => {
    await updateIdea(id, {
      status: "paused",
      paused_at: new Date().toISOString(),
      completed_at: null,
      cancelled_at: null,
    });
  };

  const markCancelled = async (id: string) => {
    await updateIdea(id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      completed_at: null,
      paused_at: null,
    });
  };

  const markMissed = async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    const updates: Partial<Idea> = {
      status: "missed",
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    };
    // Keep the scheduled date as evidence, but record it as an attempt
    // so the miss shows up in history / "go to last attempt".
    if (idea?.scheduled_date && !(idea.attempt_dates ?? []).includes(idea.scheduled_date)) {
      updates.attempt_dates = [...(idea.attempt_dates ?? []), idea.scheduled_date];
    }
    await updateIdea(id, updates);
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const idea = ideas.find((i) => i.id === id);
    const previousDate = idea?.scheduled_date;
    if (previousDate && previousDate !== date) {
      await updateIdea(id, {
        scheduled_date: date,
        attempt_dates: [...(idea.attempt_dates ?? []), previousDate],
      });
    } else {
      await updateIdea(id, { scheduled_date: date });
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const wasCollapsed = next.has(id);
      if (wasCollapsed) {
        next.delete(id);
        overridesRef.current.set(id, "expanded");
      } else {
        next.add(id);
        overridesRef.current.set(id, "collapsed");
      }
      writeTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides, overridesRef.current);
      return next;
    });
  };

  const expandIdea = (id: string) => {
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      overridesRef.current.set(id, "expanded");
      writeTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides, overridesRef.current);
      return next;
    });
  };

  const expandAll = () => {
    overridesRef.current.clear();
    const parents = ideas.filter((i) => ideas.some((c) => c.parent_id === i.id));
    for (const p of parents) {
      const depth = getDepthMap(ideas).get(p.id) ?? 0;
      if (depth >= DEFAULT_EXPAND_DEPTH) {
        overridesRef.current.set(p.id, "expanded");
      }
    }
    writeTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides, overridesRef.current);
    setCollapsedIds(new Set());
  };

  const collapseAll = () => {
    overridesRef.current.clear();
    const parents = new Set(
      ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
    );
    for (const id of parents) {
      const depth = getDepthMap(ideas).get(id) ?? 0;
      if (depth < DEFAULT_EXPAND_DEPTH) {
        overridesRef.current.set(id, "collapsed");
      }
    }
    writeTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides, overridesRef.current);
    setCollapsedIds(parents);
  };

  const tree = useMemo(() => buildTree(ideas, collapsedIds), [ideas, collapsedIds]);

  return {
    ideas,
    tree,
    loading,
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    createParentAndMove,
    reorderTasks,
    smartSortTasks,
    markDone,
    markUndone,
    markInProgress,
    markPaused,
    markCancelled,
    markMissed,
    scheduleIdea,
    restoreIdeas,
    toggleCollapse,
    expandIdea,
    expandAll,
    collapseAll,
  };
}
