"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the idea_classifications table (PUT/PATCH/DELETE). */
export const uploadIdeaClassifications: TableUploadHandler = async (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
): Promise<void> => {
  // Unique by (idea_id, scheme_id), not just id: setClassification does
  // INSERT OR REPLACE locally keyed on that pair, but a stale row from
  // another device (or a pre-dedupe local snapshot) can carry a
  // different id for the same pair. Upsert on the real unique key so the
  // newer value wins instead of erroring with 23505 and wedging the queue.
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      // Same partial-PATCH hazard as path_items: opData may omit
      // user_id/idea_id/scheme_id, tripping RLS 42501. Upload full row.
      const current = await database.getOptional<Record<string, unknown>>(
        `SELECT * FROM idea_classifications WHERE id = ?`,
        [op.id],
      );
      if (!current) return;
      const { error } = await supabase
        .from(op.table)
        .upsert({ ...(current as Record<string, unknown>) }, { onConflict: "idea_id,scheme_id" });
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
