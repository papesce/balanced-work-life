"use client";

import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the classification_schemes table (PUT/PATCH/DELETE). */
export const uploadClassificationSchemes: TableUploadHandler = async (
  op: UploadOp,
): Promise<void> => {
  // Schemes are unique by (user_id, key), not just id: the SQL migration
  // and/or another device may have seeded the same key under a different
  // id. DO NOTHING on conflict (instead of erroring and wedging the whole
  // upload queue) — the client's dedupe pass reconciles the duplicate ids.
  switch (op.op) {
    case "PUT": {
      const { error } = await supabase.from(op.table).upsert(
        { id: op.id, ...(op.opData as Record<string, unknown>) },
        {
          onConflict: "user_id,key",
          ignoreDuplicates: true,
        },
      );
      throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
      break;
    }
    case "PATCH": {
      const { error } = await supabase.from(op.table).update(op.opData!).eq("id", op.id);
      throwIfSupabaseError(error, `update ${op.table} id=${op.id}`);
      break;
    }
    case "DELETE": {
      const { error } = await supabase.from(op.table).delete().eq("id", op.id);
      throwIfSupabaseError(error, `delete ${op.table} id=${op.id}`);
      break;
    }
  }
};
