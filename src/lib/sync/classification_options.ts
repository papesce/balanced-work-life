"use client";

import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { supabase } from "../supabase";
import { throwIfSupabaseError, type TableUploadHandler, type UploadOp } from "./op";

/** Upload handler for the classification_options table (PUT/PATCH/DELETE). */
export const uploadClassificationOptions: TableUploadHandler = async (
  op: UploadOp,
  database: AbstractPowerSyncDatabase,
): Promise<void> => {
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
        throwIfSupabaseError(schemeError, `upsert parent classification_schemes id=${schemeId}`);
        const { data: serverScheme } = await supabase
          .from("classification_schemes")
          .select("id")
          .eq("id", schemeId)
          .maybeSingle();
        if (!serverScheme) {
          // Parent invisible server-side: either a key collision under a
          // different id, or the parent was deleted server-side.
          const healed = await healSchemeCollision(
            database,
            scheme as { id: string; user_id: string; key: string },
          );
          if (healed) return;
          // No server winner: parent genuinely missing — upsert it firmly
          // (without ignoreDuplicates) so the EXISTS() RLS check can pass.
          const { error: retrySchemeError } = await supabase.from("classification_schemes").upsert(
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
};

export async function healSchemeCollision(
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
