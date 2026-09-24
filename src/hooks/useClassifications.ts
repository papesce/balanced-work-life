"use client";

import { useEffect, useMemo, useRef } from "react";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { ClassificationScheme, ClassificationOption, IdeaClassification } from "@/lib/types";

interface SeedOption {
  value: string;
  label: string;
}

interface SeedScheme {
  key: string;
  label: string;
  options: SeedOption[];
}

/** v1 fixed seed data. No add/edit-scheme UI — this list is the full set. */
const SEED_SCHEMES: SeedScheme[] = [
  {
    key: "term",
    label: "Term",
    options: [
      { value: "short", label: "Short" },
      { value: "medium", label: "Medium" },
      { value: "long", label: "Long" },
    ],
  },
  {
    key: "nnl",
    label: "NNL",
    options: [
      { value: "now", label: "Now" },
      { value: "next", label: "Next" },
      { value: "later", label: "Later" },
    ],
  },
  {
    key: "moscow",
    label: "MoSCoW",
    options: [
      { value: "must", label: "Must" },
      { value: "should", label: "Should" },
      { value: "could", label: "Could" },
      { value: "wont", label: "Won't" },
    ],
  },
  {
    key: "when",
    label: "When",
    options: [
      { value: "this_week", label: "This week" },
      { value: "next_week", label: "Next week" },
      { value: "this_month", label: "This month" },
      { value: "next_month", label: "Next month" },
      { value: "this_year", label: "This year" },
      { value: "next_year", label: "Next year" },
      { value: "later", label: "Later" },
    ],
  },
];

/**
 * Deterministic seed IDs: every device derives the same id for the same
 * (user, scheme, option), so concurrent seeds converge instead of colliding
 * on UNIQUE(user_id, key). Random ids are what caused the stuck upload queue
 * when the SQL migration seeded the same keys server-side.
 */
const SEED_NAMESPACE = uuidv5.URL;

function schemeSeedId(userId: string, key: string): string {
  return uuidv5(`balanced-work-life:scheme:${userId}:${key}`, SEED_NAMESPACE);
}

function optionSeedId(userId: string, key: string, value: string): string {
  return uuidv5(`balanced-work-life:option:${userId}:${key}:${value}`, SEED_NAMESPACE);
}

export function useClassifications() {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const seedAttempted = useRef(false);

  const { data: schemeRows, isLoading: schemesLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM classification_schemes WHERE user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM classification_schemes WHERE 0",
    userId ? [userId] : [],
  );
  const { data: optionRows, isLoading: optionsLoading } = useQuery<Record<string, unknown>>(
    userId
      ? `SELECT o.* FROM classification_options o
         JOIN classification_schemes s ON s.id = o.scheme_id
         WHERE s.user_id = ? ORDER BY o.sort_order ASC`
      : "SELECT * FROM classification_options WHERE 0",
    userId ? [userId] : [],
  );
  const { data: classificationRows, isLoading: classificationsLoading } = useQuery<
    Record<string, unknown>
  >(
    userId
      ? "SELECT * FROM idea_classifications WHERE user_id = ?"
      : "SELECT * FROM idea_classifications WHERE 0",
    userId ? [userId] : [],
  );

  const isLoading = schemesLoading || optionsLoading || classificationsLoading;

  const schemes = useMemo(
    () => (schemeRows as unknown as ClassificationScheme[]) ?? [],
    [schemeRows],
  );
  const options = useMemo(
    () => (optionRows as unknown as ClassificationOption[]) ?? [],
    [optionRows],
  );
  const classifications = useMemo(
    () => (classificationRows as unknown as IdeaClassification[]) ?? [],
    [classificationRows],
  );

  // Lazy per-user seed of the fixed schemes + options. Inserts only schemes
  // missing by key, so adding a new seed scheme later backfills existing users.
  // IDs are deterministic per (user, key) so concurrent seeds converge.
  useEffect(() => {
    if (!user || isLoading || seedAttempted.current) return;
    const existingKeys = new Set(schemes.map((s) => s.key));
    if (SEED_SCHEMES.every((s) => existingKeys.has(s.key))) return;
    seedAttempted.current = true;
    const now = new Date().toISOString();
    void (async () => {
      await db.writeTransaction(async (tx) => {
        for (let s = 0; s < SEED_SCHEMES.length; s++) {
          const seed = SEED_SCHEMES[s];
          if (existingKeys.has(seed.key)) continue;
          const schemeId = schemeSeedId(user.id, seed.key);
          await tx.execute(
            `INSERT OR IGNORE INTO classification_schemes (id, user_id, key, label, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
            [schemeId, user.id, seed.key, seed.label, s, now],
          );
          for (let o = 0; o < seed.options.length; o++) {
            await tx.execute(
              `INSERT OR IGNORE INTO classification_options (id, scheme_id, value, label, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
              [
                optionSeedId(user.id, seed.key, seed.options[o].value),
                schemeId,
                seed.options[o].value,
                seed.options[o].label,
                o,
                now,
              ],
            );
          }
        }
      });
    })();
  }, [user, isLoading, schemes, db]);

  // Heal divergent seeds: the SQL migration and/or multiple devices may have
  // created several rows for the same scheme key (different ids). Merge them
  // deterministically — earliest created wins (it most likely already exists
  // server-side, so re-pointed rows upload cleanly) — re-point options +
  // classifications, delete the losers. Idempotent, so all devices converge
  // on the same winner.
  useEffect(() => {
    if (!user || isLoading) return;
    const byKey = new Map<string, ClassificationScheme[]>();
    for (const s of schemes) {
      const group = byKey.get(s.key) ?? [];
      group.push(s);
      byKey.set(s.key, group);
    }
    const dupKeys = [...byKey.entries()].filter(([, rows]) => rows.length > 1);
    const dupOptions = options.filter(
      (o, i) =>
        options.findIndex((other) => other.scheme_id === o.scheme_id && other.value === o.value) !==
        i,
    );
    if (dupKeys.length === 0 && dupOptions.length === 0) return;
    void (async () => {
      await db.writeTransaction(async (tx) => {
        // (idea_id, scheme_id) pairs already owned by the winner in this pass.
        // The memos above are a stale snapshot, so without this two losers
        // for the same idea would both re-point and violate the server UNIQUE.
        const claimed = new Set(classifications.map((c) => `${c.idea_id}:${c.scheme_id}`));
        // (idea_id, scheme_id) pairs re-pointed onto a keeper option this pass.
        const merged = new Set<string>();
        for (const rows of byKey.values()) {
          const sorted = [...rows].sort((a, b) =>
            a.created_at < b.created_at
              ? -1
              : a.created_at > b.created_at
                ? 1
                : a.id < b.id
                  ? -1
                  : 1,
          );
          const winner = sorted[0];
          const winnerOptionsByValue = new Map(
            options.filter((o) => o.scheme_id === winner.id).map((o) => [o.value, o]),
          );
          for (const loser of rows) {
            if (loser.id === winner.id) continue;
            const loserOptions = options.filter((o) => o.scheme_id === loser.id);
            for (const c of classifications.filter((x) => x.scheme_id === loser.id)) {
              const loserOpt = loserOptions.find((o) => o.id === c.option_id);
              const wOpt = loserOpt ? winnerOptionsByValue.get(loserOpt.value) : undefined;
              const winnerExists =
                claimed.has(`${c.idea_id}:${winner.id}`) ||
                classifications.some((x) => x.idea_id === c.idea_id && x.scheme_id === winner.id);
              if (!wOpt || winnerExists) {
                await tx.execute(`DELETE FROM idea_classifications WHERE id = ?`, [c.id]);
              } else {
                await tx.execute(
                  `UPDATE idea_classifications SET scheme_id = ?, option_id = ? WHERE id = ?`,
                  [winner.id, wOpt.id, c.id],
                );
                claimed.add(`${c.idea_id}:${winner.id}`);
              }
            }
            for (const o of loserOptions) {
              await tx.execute(`DELETE FROM classification_options WHERE id = ?`, [o.id]);
            }
            await tx.execute(`DELETE FROM classification_schemes WHERE id = ?`, [loser.id]);
          }
        }
        // Same-value options twice under one scheme (seed race): keep earliest.
        const keeperByKey = new Map<string, ClassificationOption>();
        for (const o of [...options].sort((a, b) =>
          a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
        )) {
          const k = `${o.scheme_id}:${o.value}`;
          const keeper = keeperByKey.get(k);
          if (keeper) {
            for (const c of classifications.filter((x) => x.option_id === o.id)) {
              const pairKey = `${c.idea_id}:${c.scheme_id}`;
              const clash =
                merged.has(pairKey) ||
                classifications.some(
                  (x) =>
                    x.id !== c.id &&
                    x.idea_id === c.idea_id &&
                    x.scheme_id === c.scheme_id &&
                    x.option_id === keeper.id,
                );
              if (clash) {
                await tx.execute(`DELETE FROM idea_classifications WHERE id = ?`, [c.id]);
              } else {
                await tx.execute(`UPDATE idea_classifications SET option_id = ? WHERE id = ?`, [
                  keeper.id,
                  c.id,
                ]);
                merged.add(pairKey);
              }
            }
            await tx.execute(`DELETE FROM classification_options WHERE id = ?`, [o.id]);
          } else {
            keeperByKey.set(k, o);
          }
        }
      });
    })();
  }, [user, isLoading, schemes, options, classifications, db]);

  const getOptionForIdea = (ideaId: string, schemeKey: string): ClassificationOption | null => {
    const scheme = schemes.find((s) => s.key === schemeKey);
    if (!scheme) return null;
    const classification = classifications.find(
      (c) => c.idea_id === ideaId && c.scheme_id === scheme.id,
    );
    if (!classification) return null;
    return options.find((o) => o.id === classification.option_id) ?? null;
  };

  /** Set (or clear with null) one scheme's value for an idea. Never touches other schemes. */
  const setClassification = async (ideaId: string, schemeKey: string, value: string | null) => {
    if (!user) return;
    const scheme = schemes.find((s) => s.key === schemeKey);
    if (!scheme) return;
    if (value == null) {
      await db.execute(`DELETE FROM idea_classifications WHERE idea_id = ? AND scheme_id = ?`, [
        ideaId,
        scheme.id,
      ]);
      return;
    }
    const option = options.find((o) => o.scheme_id === scheme.id && o.value === value);
    if (!option) return;
    const existing = classifications.find((c) => c.idea_id === ideaId && c.scheme_id === scheme.id);
    await db.execute(
      `INSERT OR REPLACE INTO idea_classifications (id, idea_id, scheme_id, option_id, user_id, created_at) VALUES (?,?,?,?,?,?)`,
      [existing?.id ?? uuidv4(), ideaId, scheme.id, option.id, user.id, new Date().toISOString()],
    );
  };

  return {
    schemes,
    options,
    classifications,
    isLoading,
    getOptionForIdea,
    setClassification,
  };
}
