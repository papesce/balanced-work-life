"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "./supabase";
import { isUuid } from "./horizonViews";
import { KNOWN_UPLOAD_TABLES } from "./powersyncSchema";
import { TABLE_UPLOAD_HANDLERS } from "./sync";
import { remapHorizonViewId } from "./sync/horizon_views";

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
    // Unknown tables must not throw: PowerSync retries the batch forever, so
    // a single poisoned op would wedge the whole upload queue. Skip it so the
    // rest of the batch (and batch.complete()) can proceed.
    if (!KNOWN_UPLOAD_TABLES.has(op.table)) {
      console.warn(
        `[QuickNote:sql] upload ${op.table} ${op.op} id=${op.id} SKIPPED: unknown table`,
      );
      return;
    }

    // All synced id columns are uuid server-side. A non-uuid id (legacy
    // horizon view ids like "seed-term") is rejected by Postgres with 22P02
    // — including on DELETE via .eq("id", badId) — so never send it to the
    // server. The horizon_views branch below remaps the local row onto a
    // fresh uuid (preserving the view); other tables keep the row local-only
    // and the poisoned op is purged via batch.complete().
    if (!isUuid(op.id)) {
      if (op.table === "horizon_views" && (op.op === "PUT" || op.op === "PATCH")) {
        await remapHorizonViewId(database, op.id);
      } else if (op.table === "horizon_views" && op.op === "DELETE") {
        // Local row already gone; just drop the poisoned DELETE op.
      } else {
        console.warn(
          `[QuickNote:sql] upload ${op.table} ${op.op} id=${op.id} SKIPPED: non-uuid id`,
        );
      }
      return;
    }

    const throwIfSupabaseError = (
      error: { message: string; code?: string } | null,
      tag: string,
    ) => {
      if (error) {
        throw new Error(`${tag}: ${error.message}${error.code ? ` (code ${error.code})` : ""}`);
      }
    };

    // Local PowerSync stores JSON columns (attempt_dates, status_history) as
    // TEXT via JSON.stringify, but Supabase expects jsonb arrays/objects.
    // Sending the raw string would persist a JSON *string* ("[\"2026-..\"\"]")
    // instead of an array, which then deserializes to [] on download and
    // silently drops history (e.g. reschedule vanishes from original date).
    if (op.table === "ideas" && op.opData && (op.op === "PUT" || op.op === "PATCH")) {
      op = { ...op, opData: normalizeIdeasPayload(op.opData) };
    }

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

    const handler = TABLE_UPLOAD_HANDLERS[op.table];
    if (handler) {
      await handler(op, database);
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
      default: {
        // Unknown op type (e.g. a future PowerSync op): skip, never wedge.
        console.warn(`[QuickNote:sql] upload ${op.table} ${op.op} id=${op.id} SKIPPED: unknown op`);
        break;
      }
    }
  }
}

/**
 * Convert locally-stringified JSON columns back to real JSON values for Supabase.
 * Handles single- and double-encoded strings so already-corrupt queue entries
 * also self-heal on next upload.
 */
export function normalizeIdeasPayload(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if ("attempt_dates" in out) {
    out.attempt_dates = parseJsonColumn(out.attempt_dates, []);
  }
  if ("status_history" in out) {
    const v = out.status_history;
    out.status_history = v == null || v === "" ? null : parseJsonColumn(v, null);
  }
  return out;
}

function parseJsonColumn(value: unknown, fallback: unknown): unknown {
  if (value == null) return fallback;
  if (Array.isArray(value) || typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  try {
    let parsed: unknown = JSON.parse(trimmed);
    // Unwrap double-encoding: '"[\"2026-..\"]"' -> '["2026-.."]' -> [...]
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return fallback;
      }
    }
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
