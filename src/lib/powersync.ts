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
    horizon: column.text,
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
    idea_id: column.text,
    tag_id: column.text,
    user_id: column.text,
  },
  { indexes: {} },
);

export const AppSchema = new Schema({
  ideas: IdeasTable,
  idea_links: IdeaLinksTable,
  tags: TagsTable,
  task_tags: TaskTagsTable,
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
      if (op.table === "task_tags") {
        const { idea_id, tag_id } = op.opData ?? {};
        switch (op.op) {
          case "PUT":
            await supabase
              .from("task_tags")
              .upsert({ idea_id, tag_id }, { onConflict: "idea_id,tag_id" });
            break;
          case "DELETE":
            await supabase.from("task_tags").delete().eq("idea_id", idea_id).eq("tag_id", tag_id);
            break;
        }
        continue;
      }

      switch (op.op) {
        case "PUT":
          await supabase.from(op.table).upsert({ id: op.id, ...op.opData });
          break;
        case "PATCH":
          await supabase.from(op.table).update(op.opData!).eq("id", op.id);
          break;
        case "DELETE":
          await supabase.from(op.table).delete().eq("id", op.id);
          break;
      }
    }
    await batch.complete();
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
