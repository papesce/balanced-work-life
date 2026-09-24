"use client";

import {
  column,
  Schema,
  Table,
  PowerSyncDatabase,
  AbstractPowerSyncDatabase,
} from "@powersync/web";
import { supabase } from "./supabase";

export const IdeasTable = new Table(
  {
    user_id: column.text,
    parent_id: column.text,
    text: column.text,
    description: column.text,
    type: column.text,
    effort: column.real,
    impact: column.real,
    urgency: column.real,
    scheduled_date: column.text,
    scheduled_time: column.text,
    duration_minutes: column.integer,
    is_priority: column.integer,
    priority_order: column.integer,
    status: column.text,
    notes: column.text,
    completed_at: column.text,
    cancelled_at: column.text,
    paused_at: column.text,
    attempt_dates: column.text,
    status_history: column.text,
    in_focus: column.integer,
    in_focus_until: column.text,
    productivity_signal: column.text,
    sort_order: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

export const IdeaLinksTable = new Table(
  {
    user_id: column.text,
    source_id: column.text,
    target_id: column.text,
    link_type: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

export const TagsTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    area: column.text,
    is_system: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const TaskTagsTable = new Table(
  {
    id: column.text,
    idea_id: column.text,
    tag_id: column.text,
    user_id: column.text,
  },
  { indexes: {} },
);

export const QuickNotesTable = new Table(
  {
    user_id: column.text,
    text: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
    archived_at: column.text,
    deleted_at: column.text,
  },
  { indexes: {} },
);

export const ClassificationSchemesTable = new Table(
  {
    user_id: column.text,
    key: column.text,
    label: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const ClassificationOptionsTable = new Table(
  {
    scheme_id: column.text,
    value: column.text,
    label: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const IdeaClassificationsTable = new Table(
  {
    idea_id: column.text,
    scheme_id: column.text,
    option_id: column.text,
    user_id: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

export const AppSchema = new Schema({
  ideas: IdeasTable,
  idea_links: IdeaLinksTable,
  tags: TagsTable,
  task_tags: TaskTagsTable,
  quick_notes: QuickNotesTable,
  classification_schemes: ClassificationSchemesTable,
  classification_options: ClassificationOptionsTable,
  idea_classifications: IdeaClassificationsTable,
});

export class SupabaseConnector {
  async fetchCredentials() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const batch = await database.getCrudBatch(100);
    if (!batch) return;

    for (const op of batch.crud) {
      const tag = `upload ${op.table} ${op.op} id=${op.id}`;
      try {
        await this.uploadOp(op, database);
      } catch (err) {
        // Surface the failing op before rethrowing: PowerSync retries the
        // batch forever, so without this the root cause (missing table,
        // RLS rejection, constraint violation) is invisible.
        console.error(
          `[QuickNote:sql] ${tag} FAILED: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
        throw err;
      }
    }
    await batch.complete();
  }

  private async uploadOp(
    op: {
      table: string;
      op: string;
      id: string;
      opData?: Record<string, unknown> | null;
    },
    database: AbstractPowerSyncDatabase,
  ): Promise<void> {
    const throwIfSupabaseError = (
      error: { message: string; code?: string } | null,
      tag: string,
    ) => {
      if (error) {
        throw new Error(`${tag}: ${error.message}${error.code ? ` (code ${error.code})` : ""}`);
      }
    };

    if (
      (op.table === "classification_schemes" ||
        op.table === "classification_options" ||
        op.table === "idea_classifications") &&
      (op.op === "PUT" || op.op === "PATCH")
    ) {
      // The queue may hold a stale snapshot: seed rows that dedupe later
      // merged or deleted. Uploading it would violate server UNIQUE / FK /
      // RLS and wedge the whole queue behind a row that no longer matters.
      // Upload current local state instead; skip rows deleted locally
      // (their queued DELETE syncs the outcome).
      const current = await database.getOptional<Record<string, unknown>>(
        `SELECT * FROM ${op.table} WHERE id = ?`,
        [op.id],
      );
      if (!current) return;
      op = { ...op, opData: { ...current } };
    }

    if (op.table === "task_tags") {
      switch (op.op) {
        case "PUT": {
          const { idea_id, tag_id } = op.opData ?? {};
          if (!idea_id || !tag_id) break;
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
      }
      return;
    }
    if (op.table === "classification_schemes") {
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
      return;
    }
    if (op.table === "classification_options") {
      // Options are unique by (scheme_id, value) but always written with
      // deterministic ids, so upsert-by-id converges across devices.
      switch (op.op) {
        case "PUT": {
          const { error } = await supabase
            .from(op.table)
            .upsert({ id: op.id, ...(op.opData as Record<string, unknown>) }, { onConflict: "id" });
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
      return;
    }

    switch (op.op) {
      case "PUT": {
        const { error } = await supabase.from(op.table).upsert({ id: op.id, ...op.opData });
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
  }
}

let powerSyncInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  if (powerSyncInstance) return powerSyncInstance;

  powerSyncInstance = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: "balanced-work-life.db",
    },
  });

  return powerSyncInstance;
}
