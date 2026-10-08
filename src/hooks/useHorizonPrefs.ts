"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import type { SecondaryLensMap } from "@/lib/storage";
import {
  HORIZON_ACTIVE_VIEW_KEY,
  HORIZON_DEFAULT_VIEW_KEY,
  HORIZON_SECONDARY_MAP_KEY,
  HORIZON_VIEWS_KEY,
  exclusiveDefaults,
  horizonPrefsId,
  horizonViewToRow,
  parseSecondaryMapText,
  planLegacyImport,
  rowToHorizonView,
  sanitizeView,
  type HorizonView,
  type HorizonViewRow,
} from "@/lib/horizonViews";

interface HorizonPrefsRow {
  id: string;
  user_id: string;
  default_view_id: string | null;
  default_lens_id: string | null;
  secondary_map: string | null;
  updated_at: string;
}

function readLegacyString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readLegacyJson(key: string): unknown {
  const raw = readLegacyString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeLegacyKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

/**
 * Synced Horizon lens configuration (saved views, default view/lens,
 * secondary-split map), same pattern as useClassifications. Active selection
 * stays local in uiPrefsStore by design.
 */
export function useHorizonPrefs() {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const importAttempted = useRef(false);
  const setUiPrefs = useUiPrefsStore((s) => s.set);

  const { data: viewRows, isLoading: viewsLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM horizon_views WHERE user_id = ? ORDER BY name ASC"
      : "SELECT * FROM horizon_views WHERE 0",
    userId ? [userId] : [],
  );
  const { data: prefsRows, isLoading: prefsLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM horizon_prefs WHERE user_id = ?"
      : "SELECT * FROM horizon_prefs WHERE 0",
    userId ? [userId] : [],
  );

  const isLoading = viewsLoading || prefsLoading;

  const views = useMemo(() => {
    const out: HorizonView[] = [];
    for (const row of (viewRows as unknown as HorizonViewRow[]) ?? []) {
      const v = rowToHorizonView(row);
      if (v) out.push(v);
    }
    return out;
  }, [viewRows]);

  const prefsRow = useMemo(
    () => ((prefsRows as unknown as HorizonPrefsRow[]) ?? [])[0] ?? null,
    [prefsRows],
  );

  const defaultViewId = prefsRow?.default_view_id ?? null;
  const defaultLensId = prefsRow?.default_lens_id ?? null;
  const secondaryMap = useMemo<SecondaryLensMap>(
    () => parseSecondaryMapText(prefsRow?.secondary_map),
    [prefsRow],
  );

  // One-time import from legacy localStorage keys. Only fills DB gaps —
  // never overwrites synced remote data. Absence of the keys afterwards is
  // the "already imported" signal; no extra flag.
  useEffect(() => {
    if (!user || isLoading || importAttempted.current) return;
    const hasLegacy =
      readLegacyString(HORIZON_VIEWS_KEY) !== null ||
      readLegacyString(HORIZON_DEFAULT_VIEW_KEY) !== null ||
      readLegacyString(HORIZON_SECONDARY_MAP_KEY) !== null ||
      readLegacyString(HORIZON_ACTIVE_VIEW_KEY) !== null;
    if (!hasLegacy) return;
    importAttempted.current = true;
    const legacyViews = readLegacyJson(HORIZON_VIEWS_KEY);
    const legacyDefault = readLegacyString(HORIZON_DEFAULT_VIEW_KEY);
    const legacySecondary = readLegacyJson(HORIZON_SECONDARY_MAP_KEY);
    const legacyActive = readLegacyString(HORIZON_ACTIVE_VIEW_KEY);
    const plan = planLegacyImport(
      {
        views: legacyViews,
        defaultViewId: legacyDefault,
        secondaryMap: legacySecondary,
      },
      {
        viewCount: views.length,
        hasDefault: defaultViewId != null || defaultLensId != null,
        hasSecondaryMap: Object.keys(secondaryMap).length > 0,
      },
    );
    // Move the active view id into uiPrefsStore (local device state).
    if (legacyActive) {
      const stillExists =
        views.some((v) => v.id === legacyActive) ||
        plan.viewsToInsert.some((v) => v.id === legacyActive);
      if (stillExists) setUiPrefs({ horizonActiveViewId: legacyActive });
    }
    void (async () => {
      try {
        await db.writeTransaction(async (tx) => {
          for (const view of plan.viewsToInsert) {
            const row = horizonViewToRow(view, user.id);
            const now = new Date().toISOString();
            await tx.execute(
              `INSERT OR IGNORE INTO horizon_views (id, user_id, name, primary_scheme, splits, sort_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
              [
                row.id,
                row.user_id,
                row.name,
                row.primary_scheme,
                row.splits,
                row.sort_by,
                now,
                now,
              ],
            );
          }
          if (plan.adoptDefault != null || plan.adoptSecondaryMap != null) {
            await tx.execute(
              `INSERT OR IGNORE INTO horizon_prefs (id, user_id, default_view_id, default_lens_id, secondary_map, updated_at) VALUES (?,?,?,?,?,?)`,
              [
                horizonPrefsId(user.id),
                user.id,
                plan.adoptDefault,
                null,
                plan.adoptSecondaryMap ? JSON.stringify(plan.adoptSecondaryMap) : "{}",
                new Date().toISOString(),
              ],
            );
          }
        });
      } finally {
        removeLegacyKey(HORIZON_VIEWS_KEY);
        removeLegacyKey(HORIZON_DEFAULT_VIEW_KEY);
        removeLegacyKey(HORIZON_SECONDARY_MAP_KEY);
        removeLegacyKey(HORIZON_ACTIVE_VIEW_KEY);
      }
    })();
  }, [user, isLoading, views, defaultViewId, defaultLensId, secondaryMap, db, setUiPrefs]);

  const ensurePrefsRow = useCallback(async () => {
    if (!user) return;
    await db.execute(
      `INSERT OR IGNORE INTO horizon_prefs (id, user_id, default_view_id, default_lens_id, secondary_map, updated_at) VALUES (?,?,?,?,?,?)`,
      [horizonPrefsId(user.id), user.id, null, null, "{}", new Date().toISOString()],
    );
  }, [db, user]);

  const saveView = useCallback(
    async (view: HorizonView) => {
      const clean = sanitizeView(view);
      if (!clean || !user) return;
      const row = horizonViewToRow(clean, user.id);
      const now = new Date().toISOString();
      await db.execute(
        `INSERT INTO horizon_views (id, user_id, name, primary_scheme, splits, sort_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, primary_scheme = excluded.primary_scheme, splits = excluded.splits, sort_by = excluded.sort_by, updated_at = excluded.updated_at`,
        [row.id, row.user_id, row.name, row.primary_scheme, row.splits, row.sort_by, now, now],
      );
    },
    [db, user],
  );

  const deleteView = useCallback(
    async (id: string) => {
      if (!user) return;
      await db.writeTransaction(async (tx) => {
        await tx.execute(`DELETE FROM horizon_views WHERE id = ?`, [id]);
        await tx.execute(
          `UPDATE horizon_prefs SET default_view_id = NULL, updated_at = ? WHERE user_id = ? AND default_view_id = ?`,
          [new Date().toISOString(), user.id, id],
        );
      });
    },
    [db, user],
  );

  /** Set the default view or the default built-in lens — one statement, so
   *  the two stars are mutually exclusive. Null clears both. */
  const setDefault = useCallback(
    async (input: { viewId?: string | null; lensId?: string | null }) => {
      if (!user) return;
      const next = exclusiveDefaults(input);
      await ensurePrefsRow();
      await db.execute(
        `UPDATE horizon_prefs SET default_view_id = ?, default_lens_id = ?, updated_at = ? WHERE user_id = ?`,
        [next.default_view_id, next.default_lens_id, new Date().toISOString(), user.id],
      );
    },
    [db, user, ensurePrefsRow],
  );

  const setSecondaryMap = useCallback(
    async (map: SecondaryLensMap) => {
      if (!user) return;
      await ensurePrefsRow();
      await db.execute(
        `UPDATE horizon_prefs SET secondary_map = ?, updated_at = ? WHERE user_id = ?`,
        [JSON.stringify(map), new Date().toISOString(), user.id],
      );
    },
    [db, user, ensurePrefsRow],
  );

  return {
    views,
    defaultViewId,
    defaultLensId,
    secondaryMap,
    isLoading,
    saveView,
    deleteView,
    setDefault,
    setSecondaryMap,
  };
}

export type UseHorizonPrefsResult = ReturnType<typeof useHorizonPrefs>;
