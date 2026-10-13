"use client";

import { useCallback } from "react";
import type { usePowerSync } from "@powersync/react";
import type { Idea } from "@/lib/types";

type Db = ReturnType<typeof usePowerSync>;

/**
 * Sibling ordering writes: explicit reorder, score-based smart sort,
 * and parent/position moves. Needs only the db (plus ideas for moves).
 */
export function useIdeaOrder({ db, ideas }: { db: Db; ideas: Idea[] }) {
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

  return { reorderTasks, smartSortTasks, moveIdea };
}
