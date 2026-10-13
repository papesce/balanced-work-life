"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "../supabase";
import { newHorizonViewId } from "../horizonViews";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the horizon_views table (PUT/PATCH/DELETE). */
export const uploadHorizonViews: TableUploadHandler = async (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
): Promise<void> => {
  // Views are keyed by id; the queue may hold a stale snapshot of a
  // row that was edited or deleted locally since. Upload current local
  // state instead; skip rows deleted locally (their queued DELETE syncs
  // the outcome) so a stale PUT can't resurrect them server-side.
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      const current = await database.getOptional<Record<string, unknown>>(
        `SELECT * FROM horizon_views WHERE id = ?`,
        [op.id],
      );
      if (!current) return;
      if (op.op === "PUT") {
        const { error } = await supabase
          .from(op.table)
          .upsert({ ...(current as Record<string, unknown>) }, { onConflict: "id" });
        throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
      } else {
        const { error } = await supabase
          .from(op.table)
          .update({ ...(current as Record<string, unknown>) })
          .eq("id", op.id);
        throwIfSupabaseError(error, `update ${op.table} id=${op.id}`);
      }
      break;
    }
    case "DELETE": {
      const { error } = await supabase.from(op.table).delete().eq("id", op.id);
      throwIfSupabaseError(error, `delete ${op.table} id=${op.id}`);
      break;
    }
  }
};

export async function remapHorizonViewId(
  database: AbstractPowerSyncDatabase,
  oldId: string,
): Promise<void> {
  const row = await database.getOptional<Record<string, unknown>>(
    `SELECT * FROM horizon_views WHERE id = ?`,
    [oldId],
  );
  if (!row) return;
  const newId = newHorizonViewId();
  const now = new Date().toISOString();
  await database.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT OR IGNORE INTO horizon_views (id, user_id, name, primary_scheme, description, column_order, splits, is_builtin, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        newId,
        row.user_id,
        row.name,
        row.primary_scheme,
        (row.description as string) ?? "",
        (row.column_order as string) ?? "[]",
        row.splits,
        (row.is_builtin as number) ?? 0,
        (row.created_at as string) ?? now,
        now,
      ],
    );
    await tx.execute(
      `UPDATE horizon_prefs SET default_view_id = ?, updated_at = ? WHERE default_view_id = ?`,
      [newId, now, oldId],
    );
    await tx.execute(`DELETE FROM horizon_views WHERE id = ?`, [oldId]);
  });
  console.warn(`[QuickNote:sql] remapped horizon_views id=${oldId} -> ${newId}`);
}
