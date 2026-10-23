"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the path_items table (PUT/PATCH/DELETE). */
export const uploadPathItems: TableUploadHandler = async (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
): Promise<void> => {
  // Unique by (path_id, idea_id), not just id: addItem is idempotent
  // locally, but a stale row from another device can carry a different
  // id for the same pair. Upsert on the real unique key so the newer
  // value wins instead of erroring with 23505 and wedging the queue.
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      // PATCH opData only carries changed columns (e.g. {x, y}) — no
      // user_id/path_id/idea_id. Upserting that partial payload violates
      // NOT NULL and the RLS WITH CHECK (auth.uid() = user_id) with
      // 42501. Upload the full current local row instead.
      const current = await database.getOptional<Record<string, unknown>>(
        `SELECT * FROM path_items WHERE id = ?`,
        [op.id],
      );
      if (!current) return;
      const { error } = await supabase
        .from(op.table)
        .upsert({ ...(current as Record<string, unknown>) });
      throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
      break;
    }
    case "DELETE": {
      const { error } = await supabase.from(op.table).delete().eq("id", op.id);
      throwIfSupabaseError(error, `delete ${op.table} id=${op.id}`);
      break;
    }
  }
};
