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
      // The options RLS policy checks ownership via the parent scheme row,
      // so the parent must exist server-side first. The SQL migration seeded
      // schemes with random UUIDs while the client seeds deterministic
      // uuidv5 ids: same (user_id, key) can exist under a different id, in
      // which case the parent upsert below is a no-op (ignoreDuplicates) and
      // the option upsert would fail RLS 42501. Self-heal by re-pointing
      // local rows onto the server winner instead of wedging the queue.
      switch (op.op) {
        case "PUT":
        case "PATCH": {
          const data = { id: op.id, ...(op.opData as Record<string, unknown>) } as Record<
            string,
            unknown
          >;
          const schemeId = data.scheme_id;
          if (typeof schemeId === "string" && schemeId.length > 0) {
            const scheme = await database.getOptional<Record<string, unknown>>(
              `SELECT * FROM classification_schemes WHERE id = ?`,
              [schemeId],
            );
            // Orphan (parent deleted/merged locally): skip; its queued
            // DELETE syncs the outcome instead of violating FK/RLS.
            if (!scheme) return;
            const { error: schemeError } = await supabase.from("classification_schemes").upsert(
              { ...(scheme as Record<string, unknown>) },
              {
                onConflict: "user_id,key",
                ignoreDuplicates: true,
              },
            );
            throwIfSupabaseError(
              schemeError,
              `upsert parent classification_schemes id=${schemeId}`,
            );
            const { data: serverScheme } = await supabase
              .from("classification_schemes")
              .select("id")
              .eq("id", schemeId)
              .maybeSingle();
            if (!serverScheme) {
              // Parent invisible server-side: either a key collision under a
              // different id, or the parent was deleted server-side.
              const healed = await this.healSchemeCollision(
                database,
                scheme as { id: string; user_id: string; key: string },
              );
              if (healed) return;
              // No server winner: parent genuinely missing — upsert it firmly
              // (without ignoreDuplicates) so the EXISTS() RLS check can pass.
              const { error: retrySchemeError } = await supabase
                .from("classification_schemes")
                .upsert(
                  { ...(scheme as Record<string, unknown>) },
                  {
                    onConflict: "user_id,key",
                  },
                );
              throwIfSupabaseError(
                retrySchemeError,
                `upsert parent classification_schemes id=${schemeId}`,
              );
            }
            // Re-read: healing may have re-pointed or removed this row.
            const fresh = await database.getOptional<Record<string, unknown>>(
              `SELECT * FROM classification_options WHERE id = ?`,
              [op.id],
            );
            if (!fresh) return;
            if (op.op === "PUT") {
              const { error } = await supabase
                .from(op.table)
                .upsert({ ...(fresh as Record<string, unknown>) }, { onConflict: "id" });
              throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
            } else {
              const { error } = await supabase
                .from(op.table)
                .update({ ...(fresh as Record<string, unknown>) })
                .eq("id", op.id);
              throwIfSupabaseError(error, `update ${op.table} id=${op.id}`);
            }
          } else if (op.op === "PUT") {
            const { error } = await supabase.from(op.table).upsert(data, { onConflict: "id" });
            throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
          } else {
            const { error } = await supabase.from(op.table).update(op.opData!).eq("id", op.id);
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
      return;
    }
    if (op.table === "idea_classifications") {
      // Unique by (idea_id, scheme_id), not just id: setClassification does
      // INSERT OR REPLACE locally keyed on that pair, but a stale row from
      // another device (or a pre-dedupe local snapshot) can carry a
      // different id for the same pair. Upsert on the real unique key so the
      // newer value wins instead of erroring with 23505 and wedging the queue.
      switch (op.op) {
        case "PUT":
        case "PATCH": {
          const { error } = await supabase
            .from(op.table)
            .upsert(
              { id: op.id, ...(op.opData as Record<string, unknown>) },
              { onConflict: "idea_id,scheme_id" },
            );
          throwIfSupabaseError(error, `upsert ${op.table} id=${op.id}`);
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

  /**
   * Re-point a locally-seeded scheme (loser id) onto the server winner for
   * the same (user_id, key). Returns true when a winner was found and local
   * rows were reconciled (caller should skip the current op — the fixed rows
   * re-enter the queue with the visible parent id).
   */
  private async healSchemeCollision(
    database: AbstractPowerSyncDatabase,
    loser: { id: string; user_id: string; key: string },
  ): Promise<boolean> {
    const { data: winner } = await supabase
      .from("classification_schemes")
      .select("id")
      .eq("user_id", loser.user_id)
      .eq("key", loser.key)
      .maybeSingle();
    const winnerId =
      winner && typeof (winner as { id: unknown }).id === "string"
        ? (winner as { id: string }).id
        : null;
    if (!winnerId || winnerId === loser.id) return false;

    // Map server option value -> id so same-value options converge onto the
    // server id instead of colliding on UNIQUE(scheme_id, value).
    let serverByValue = new Map<string, string>();
    try {
      const { data: serverOptions } = await supabase
        .from("classification_options")
        .select("id,value")
        .eq("scheme_id", winnerId);
      if (Array.isArray(serverOptions)) {
        for (const o of serverOptions as Array<{ id: string; value: string }>) {
          if (o && typeof o.id === "string" && typeof o.value === "string") {
            serverByValue.set(o.value, o.id);
          }
        }
      }
    } catch {
      serverByValue = new Map();
    }

    await database.writeTransaction(async (tx) => {
      const loserOptions = await tx.getAll<Record<string, unknown>>(
        `SELECT * FROM classification_options WHERE scheme_id = ?`,
        [loser.id],
      );
      for (const lo of loserOptions) {
        const optId = lo.id as string;
        const value = lo.value as string;
        const serverOptId = serverByValue.get(value);
        if (serverOptId && serverOptId !== optId) {
          // Same value already exists server-side under another id:
          // move classifications onto the server id, drop the loser.
          // DELETE ... WHERE option_id + scheme guard keeps (idea,scheme)
          // pairs that already reference the winner intact.
          await tx.execute(
            `DELETE FROM idea_classifications WHERE option_id = ? AND idea_id IN (
               SELECT idea_id FROM idea_classifications WHERE option_id = ?
             )`,
            [optId, serverOptId],
          );
          await tx.execute(`UPDATE idea_classifications SET option_id = ? WHERE option_id = ?`, [
            serverOptId,
            optId,
          ]);
          await tx.execute(`DELETE FROM classification_options WHERE id = ?`, [optId]);
        } else {
          await tx.execute(`UPDATE classification_options SET scheme_id = ? WHERE id = ?`, [
            winnerId,
            optId,
          ]);
        }
      }
      await tx.execute(`UPDATE idea_classifications SET scheme_id = ? WHERE scheme_id = ?`, [
        winnerId,
        loser.id,
      ]);
      await tx.execute(`DELETE FROM classification_schemes WHERE id = ?`, [loser.id]);
    });
    return true;
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
