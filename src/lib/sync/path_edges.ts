"use client";

import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler } from "./op";

/** Upload path edge operations from the complete current local row. */
export const uploadPathEdges: TableUploadHandler = async (op, database) => {
  switch (op.op) {
    case "PUT":
    case "PATCH": {
      const current = await database.getOptional<Record<string, unknown>>(
        "SELECT * FROM path_edges WHERE id = ?",
        [op.id],
      );
      if (!current) return;
      const { error } = await supabase.from("path_edges").upsert({ ...current });
      throwIfSupabaseError(error, `upsert path_edges id=${op.id}`);
      break;
    }
    case "DELETE": {
      const { error } = await supabase.from("path_edges").delete().eq("id", op.id);
      throwIfSupabaseError(error, `delete path_edges id=${op.id}`);
      break;
    }
  }
};
