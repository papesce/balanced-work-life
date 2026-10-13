"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the horizon_prefs table (PUT/PATCH/DELETE). */
export const uploadHorizonPrefs: TableUploadHandler = async (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
): Promise<void> => {
  // One row per user, upserted on the real unique key (user_id): the
  // deterministic id is stable per user, but a stale row from another
  // device must update the winner instead of erroring 23505 and wedging
  // the queue.
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      const current = await database.getOptional<Record<string, unknown>>(
        `SELECT * FROM horizon_prefs WHERE id = ?`,
        [op.id],
      );
      if (!current) return;
      const { error } = await supabase
        .from(op.table)
        .upsert({ ...(current as Record<string, unknown>) }, { onConflict: "user_id" });
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
