"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { deserializePathItem, type PathItem, type PathPosition } from "@/lib/paths";

export function usePathItems(pathId: string) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  const hasScope = Boolean(userId && pathId);
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    hasScope ? "SELECT * FROM path_items WHERE path_id = ?" : "SELECT * FROM path_items WHERE 0",
    hasScope ? [pathId] : [],
  );

  const items: PathItem[] = useMemo(() => rawRows.map(deserializePathItem), [rawRows]);

  /**
   * Idempotent add: re-adding an existing member keeps its row (and id)
   * and updates its position. Local synced tables are views, so no
   * `ON CONFLICT` upsert — UPDATE first, INSERT OR IGNORE when new.
   */
  const addItem = async (ideaId: string, x = 0, y = 0): Promise<void> => {
    if (!user || !pathId || !ideaId) return;
    const updated = await db.execute(
      `UPDATE path_items SET x = ?, y = ? WHERE path_id = ? AND idea_id = ?`,
      [x, y, pathId, ideaId],
    );
    if (updated.rowsAffected === 0) {
      const now = new Date().toISOString();
      await db.execute(
        `INSERT OR IGNORE INTO path_items (id, user_id, path_id, idea_id, x, y, created_at) VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), user.id, pathId, ideaId, x, y, now],
      );
    }
  };

  const removeItem = async (ideaId: string): Promise<void> => {
    if (!pathId || !ideaId) return;
    await db.execute(`DELETE FROM path_items WHERE path_id = ? AND idea_id = ?`, [pathId, ideaId]);
  };

  /** Persist drag/layout positions in a single transaction. */
  const moveItems = async (positions: PathPosition[]): Promise<void> => {
    if (positions.length === 0) return;
    await db.writeTransaction(async (tx) => {
      for (const pos of positions) {
        await tx.execute(`UPDATE path_items SET x = ?, y = ? WHERE path_id = ? AND idea_id = ?`, [
          pos.x,
          pos.y,
          pathId,
          pos.ideaId,
        ]);
      }
    });
  };

  return { items, loading: isLoading, addItem, removeItem, moveItems };
}
