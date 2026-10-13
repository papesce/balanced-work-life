"use client";

import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the task_tags table (PUT/PATCH/DELETE). */
export const uploadTaskTags: TableUploadHandler = async (op: UploadOp): Promise<void> => {
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      const { idea_id, tag_id } = op.opData ?? {};
      if (!idea_id || !tag_id) {
        console.warn(
          `[QuickNote:sql] upload task_tags ${op.op} id=${op.id} SKIPPED: missing idea_id/tag_id`,
        );
        break;
      }
      const { error } = await supabase
        .from("task_tags")
        .upsert({ id: op.id, idea_id, tag_id }, { onConflict: "idea_id,tag_id" });
      throwIfSupabaseError(error, `upsert task_tags id=${op.id}`);
      break;
    }
    case "DELETE": {
      const { error } = await supabase.from("task_tags").delete().eq("id", op.id);
      throwIfSupabaseError(error, `delete task_tags id=${op.id}`);
      break;
    }
    default: {
      console.warn(`[QuickNote:sql] upload task_tags ${op.op} id=${op.id} SKIPPED: unknown op`);
      break;
    }
  }
};
