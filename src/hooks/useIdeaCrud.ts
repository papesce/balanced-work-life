"use client";

import { v4 as uuidv4 } from "uuid";
import type { usePowerSync } from "@powersync/react";
import { appendStatusHistory } from "@/lib/statusHistory";
import { ideaInsertSql, ideaInsertParams } from "@/lib/ideaInsert";
import { sortIdeasForInsert } from "@/lib/ideaModel";
import type { Idea } from "@/lib/types";
import type { CreateIdeaPosition } from "@/hooks/useIdeas";

type Db = ReturnType<typeof usePowerSync>;

interface UseIdeaCrudParams {
  db: Db;
  /** Empty when signed out — writes become no-ops returning "". */
  userId: string;
  /** Current snapshot, for sibling order, previous values and rollback. */
  ideas: Idea[];
  pendingIdeas: Map<string, Partial<Idea>>;
  setPendingIdea: (id: string, patch: Partial<Idea>) => void;
  removePendingIdea: (id: string) => void;
}

/**
 * Idea create/update/delete/restore against PowerSync with optimistic
 * overlay handling. Ordering and status transitions live in sibling hooks.
 */
export function useIdeaCrud({
  db,
  userId,
  ideas,
  pendingIdeas,
  setPendingIdea,
  removePendingIdea,
}: UseIdeaCrudParams) {
  const createIdea = async (
    text: string,
    parentId: string | null = null,
    position: CreateIdeaPosition = "bottom",
    initialUpdates: Partial<Idea> = {},
  ): Promise<string> => {
    if (!userId) return "";
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
      user_id: userId,
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
    if (!userId) return "";
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
          user_id: userId,
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

  return { createIdea, updateIdea, deleteIdea, restoreIdeas, createParentAndMove };
}
