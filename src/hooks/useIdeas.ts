"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { Idea, IdeaNode } from "@/lib/types";
import { getToday, getWindowRange } from "@/lib/dateUtils";
import { appendStatusHistory } from "@/lib/statusHistory";
import {
  STORAGE_KEYS,
  TreeOverrideState,
  readTreeOverrides,
  writeTreeOverrides,
} from "@/lib/storage";

const DEFAULT_EXPAND_DEPTH = 1;

export type IdeasScope = "all" | "this_month";
export type CreateIdeaPosition = "top" | "bottom";
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

function computeCollapsedIds(ideas: Idea[], overrides: Map<string, OverrideState>): Set<string> {
  const depths = getDepthMap(ideas);
  const collapsed = new Set<string>();
  const parents = new Set(
    ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
  );

  for (const id of parents) {
    const depth = depths.get(id) ?? 0;
    const override = overrides.get(id);
    if (override === "expanded") continue;
    if (override === "collapsed" || depth >= DEFAULT_EXPAND_DEPTH) {
      collapsed.add(id);
    }
  }
  return collapsed;
}

function buildTree(ideas: Idea[], collapsedIds: Set<string>): IdeaNode[] {
  const map = new Map<string, IdeaNode>();
  const roots: IdeaNode[] = [];

  for (const idea of ideas) {
    map.set(idea.id, { ...idea, children: [], collapsed: collapsedIds.has(idea.id) });
  }

  for (const idea of ideas) {
    const node = map.get(idea.id)!;
    if (idea.parent_id && map.has(idea.parent_id)) {
      map.get(idea.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: IdeaNode[]) => {
    nodes.sort((a, b) => {
      const aDone = a.completed_at ? 1 : 0;
      const bDone = b.completed_at ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.sort_order - b.sort_order;
    });
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
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
function deserializeIdea(row: Record<string, unknown>): Idea {
  return {
    ...row,
    is_priority: Boolean(row.is_priority),
    attempt_dates: row.attempt_dates ? (JSON.parse(row.attempt_dates as string) as string[]) : [],
    status_history: row.status_history
      ? (JSON.parse(row.status_history as string) as { status: Idea["status"]; at: string }[])
      : null,
  } as unknown as Idea;
}

function buildScopedQuery(userId: string, scope: IdeasScope): { sql: string; params: string[] } {
  if (scope === "this_month") {
    const { start, end } = getWindowRange("month", getToday());
    return {
      sql: `SELECT * FROM ideas WHERE user_id = ?
            AND (
              (scheduled_date >= ? AND scheduled_date <= ?)
              OR (scheduled_date IS NULL AND status NOT IN ('completed','cancelled','archived'))
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

export function useIdeas(options: { scope?: IdeasScope } = {}) {
  const { scope = "all" } = options;
  const { user } = useAuth();
  const db = usePowerSync();

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const overridesRef = useRef<Map<string, OverrideState>>(new Map());

  useEffect(() => {
    overridesRef.current = readTreeOverrides(STORAGE_KEYS.brainstormTreeOverrides);
  }, []);

  const userId = user?.id ?? "";
  const { sql, params } = buildScopedQuery(userId, scope);

  const { data: rawRows, isLoading: loading } = useQuery<Record<string, unknown>>(
    userId ? sql : "SELECT * FROM ideas WHERE 0",
    userId ? params : [],
  );

  const ideas: Idea[] = rawRows.map(deserializeIdea);

  useEffect(() => {
    if (ideas.length > 0) {
      setCollapsedIds(computeCollapsedIds(ideas, overridesRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows]);

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
    const sortOrder = position === "top" ? 0 : maxOrder + 1;
    const reorderedSiblings =
      position === "top" ? siblings.map((s) => ({ ...s, sort_order: s.sort_order + 1 })) : [];
    const idea: Idea = {
      id,
      user_id: user.id,
      parent_id: parentId,
      text,
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
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
      attempt_dates: [],
      status_history: null,
      horizon: null,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
      ...initialUpdates,
    };
    await db.execute(
      `INSERT INTO ideas (id, user_id, parent_id, text, type, effort, impact, urgency,
        scheduled_date, scheduled_time, duration_minutes, is_priority, priority_order,
        status, notes, completed_at, cancelled_at, paused_at, attempt_dates, status_history,
        horizon, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        idea.id,
        idea.user_id,
        idea.parent_id,
        idea.text,
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
        idea.completed_at,
        idea.cancelled_at,
        idea.paused_at,
        JSON.stringify(idea.attempt_dates),
        idea.status_history ? JSON.stringify(idea.status_history) : null,
        idea.horizon,
        idea.sort_order,
        idea.created_at,
        idea.updated_at,
      ],
    );
    for (const sibling of reorderedSiblings) {
      await db.execute(`UPDATE ideas SET sort_order = ? WHERE id = ?`, [
        sibling.sort_order,
        sibling.id,
      ]);
    }
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const updatedAt = new Date().toISOString();
    const previous = ideas.find((i) => i.id === id);

    const finalUpdates = { ...updates };
    if (updates.status && previous && updates.status !== previous.status) {
      finalUpdates.status_history = appendStatusHistory(previous, updates.status);
    }

    const fields = Object.keys(finalUpdates);
    if (fields.length === 0) return;

    const setClauses = [...fields, "updated_at"].map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => {
      const v = finalUpdates[f as keyof Idea];
      if (f === "attempt_dates") return JSON.stringify(v ?? []);
      if (f === "status_history") return v ? JSON.stringify(v) : null;
      if (f === "is_priority") return v ? 1 : 0;
      return v ?? null;
    });
    values.push(updatedAt);

    await db.execute(`UPDATE ideas SET ${setClauses} WHERE id = ?`, [...values, id]);
  };

  const deleteIdea = async (id: string) => {
    const toDelete = new Set<string>();
    const collect = (nodeId: string) => {
      toDelete.add(nodeId);
      ideas.filter((i) => i.parent_id === nodeId).forEach((child) => collect(child.id));
    };
    collect(id);
    for (const ideaId of toDelete) {
      await db.execute(`DELETE FROM ideas WHERE id = ?`, [ideaId]);
    }
  };

  const restoreIdeas = async (restoredIdeas: Idea[]) => {
    if (restoredIdeas.length === 0) return;
    const orderedIdeas = sortIdeasForInsert(restoredIdeas);
    for (const idea of orderedIdeas) {
      await db.execute(
        `INSERT OR REPLACE INTO ideas (id, user_id, parent_id, text, type, effort, impact, urgency,
          scheduled_date, scheduled_time, duration_minutes, is_priority, priority_order,
          status, notes, completed_at, cancelled_at, paused_at, attempt_dates, status_history,
          horizon, sort_order, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          idea.id,
          idea.user_id,
          idea.parent_id,
          idea.text,
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
          idea.completed_at,
          idea.cancelled_at,
          idea.paused_at,
          JSON.stringify(idea.attempt_dates),
          idea.status_history ? JSON.stringify(idea.status_history) : null,
          idea.horizon,
          idea.sort_order,
          idea.created_at,
          idea.updated_at,
        ],
      );
    }
  };

  const reorderTasks = useCallback(
    async (taskIds: string[]) => {
      const updatedAt = new Date().toISOString();
      for (let i = 0; i < taskIds.length; i++) {
        await db.execute(`UPDATE ideas SET sort_order = ?, updated_at = ? WHERE id = ?`, [
          i,
          updatedAt,
          taskIds[i],
        ]);
      }
    },
    [db],
  );

  const smartSortTasks = useCallback(
    async (tasksInGroup: Idea[]) => {
      const computeScore = (t: Idea): number => {
        const urgency = t.urgency ?? 3;
        const impact = t.impact ?? 3;
        const effort = t.effort ?? 3;
        const priorityBoost = t.is_priority ? 2 : 1;
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
    const reordered = siblings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s, idx) => ({
        ...s,
        sort_order: idx >= newSortOrder ? idx + 1 : idx,
      }));

    await db.execute(
      `UPDATE ideas SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [newParentId, newSortOrder, updatedAt, id],
    );

    for (const sibling of reordered) {
      if (sibling.sort_order !== ideas.find((i) => i.id === sibling.id)?.sort_order) {
        await db.execute(`UPDATE ideas SET sort_order = ? WHERE id = ?`, [
          sibling.sort_order,
          sibling.id,
        ]);
      }
    }
  };

  const markDone = async (id: string) => {
    const now = new Date().toISOString();
    await updateIdea(id, { status: "completed", completed_at: now });
  };

  const markUndone = async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    const fallbackStatus = idea?.scheduled_date
      ? idea?.scheduled_time
        ? "scheduled"
        : "planned"
      : "draft";
    await updateIdea(id, { status: fallbackStatus, completed_at: null });
  };

  const markInProgress = async (id: string) => {
    await updateIdea(id, { status: "in_progress" });
  };

  const markPaused = async (id: string) => {
    await updateIdea(id, { status: "paused", paused_at: new Date().toISOString() });
  };

  const markCancelled = async (id: string) => {
    await updateIdea(id, { status: "cancelled", cancelled_at: new Date().toISOString() });
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

  const tree = buildTree(ideas, collapsedIds);

  return {
    ideas,
    tree,
    loading,
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    reorderTasks,
    smartSortTasks,
    markDone,
    markUndone,
    markInProgress,
    markPaused,
    markCancelled,
    scheduleIdea,
    restoreIdeas,
    toggleCollapse,
    expandIdea,
    expandAll,
    collapseAll,
  };
}
