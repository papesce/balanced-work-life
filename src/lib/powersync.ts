import {
  WASQLitePowerSyncDatabaseOpenFactory,
  column,
  Schema,
  Table,
} from "@powersync/web";
import { supabase } from "./supabase";

export const IdeasTable = new Table(
  {
    user_id: column.text,
    parent_id: column.text,
    text: column.text,
    type: column.text,
    effort: column.text,
    impact: column.text,
    urgency: column.text,
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
    horizon: column.text,
    sort_order: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} }
);

export const IdeaLinksTable = new Table(
  {
    user_id: column.text,
    source_id: column.text,
    target_id: column.text,
    link_type: column.text,
    created_at: column.text,
  },
  { indexes: {} }
);

export const TagsTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    area: column.text,
    is_system: column.integer,
    created_at: column.text,
  },
  { indexes: {} }
);

export const TaskTagsTable = new Table(
  {
    idea_id: column.text,
    tag_id: column.text,
  },
  { indexes: {} }
);

export const AppSchema = new Schema({
  ideas: IdeasTable,
  idea_links: IdeaLinksTable,
  tags: TagsTable,
  task_tags: TaskTagsTable,
});

let powerSyncInstance: Awaited<
  ReturnType<WASQLitePowerSyncDatabaseOpenFactory["getInstance"]>
> | null = null;

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

  async uploadData(database: { getCrudBatch: (limit: number) => Promise<unknown> }) {
    const batch = await database.getCrudBatch(100);
    if (!batch) return;

    const ops = (batch as { crud: Array<{ op: string; table: string; id: string; opData?: Record<string, unknown> }> }).crud;
    for (const op of ops) {
      const { op: operation, table, id, opData } = op;
      switch (operation) {
        case "PUT":
          await supabase.from(table).upsert({ id, ...opData });
          break;
        case "PATCH":
          await supabase.from(table).update(opData!).eq("id", id);
          break;
        case "DELETE":
          await supabase.from(table).delete().eq("id", id);
          break;
      }
    }
    await (batch as { complete: () => Promise<void> }).complete();
  }
}

export async function getPowerSync() {
  if (powerSyncInstance) return powerSyncInstance;

  const factory = new WASQLitePowerSyncDatabaseOpenFactory({
    dbFilename: "balanced-work-life.db",
    schema: AppSchema,
  });

  powerSyncInstance = await factory.getInstance();
  return powerSyncInstance;
}
