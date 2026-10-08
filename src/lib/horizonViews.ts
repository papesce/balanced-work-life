import { v5 as uuidv5 } from "uuid";
import type { SecondaryLensMap } from "@/lib/storage";

export const HORIZON_VIEWS_KEY = "horizon-views-v1";
export const HORIZON_ACTIVE_VIEW_KEY = "horizon-active-view-id";
export const HORIZON_DEFAULT_VIEW_KEY = "horizon-default-view-id";
/** Legacy localStorage key for the secondary-split map (imported once, then removed). */
export const HORIZON_SECONDARY_MAP_KEY = "horizon-secondary-map";

/** Column key used in splits: option value, or "unclassified" for the null column. */
export function viewColumnKey(colKey: string | null): string {
  return colKey ?? "unclassified";
}

export interface HorizonView {
  id: string;
  name: string;
  /** Primary scheme key, e.g. "term". */
  primary: string;
  /** Column group key -> secondary scheme key (null = no split). */
  splits: Record<string, string | null>;
  /** Sort items within each group. */
  sortBy?: "manual" | "priority";
}

export function sanitizeView(raw: unknown): HorizonView | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.name !== "string" || !v.name.trim()) return null;
  if (typeof v.primary !== "string" || !v.primary) return null;
  const splits: Record<string, string | null> = {};
  const rawSplits = v.splits;
  if (rawSplits && typeof rawSplits === "object") {
    for (const [k, val] of Object.entries(rawSplits as Record<string, unknown>)) {
      splits[k] = typeof val === "string" && val.length > 0 ? val : null;
    }
  }
  return {
    id: v.id,
    name: v.name.trim(),
    primary: v.primary,
    splits,
    sortBy: v.sortBy === "priority" ? "priority" : "manual",
  };
}

/** Deterministic horizon_prefs row id per user so every device converges. */
export function horizonPrefsId(userId: string): string {
  return uuidv5(`balanced-work-life:horizon-prefs:${userId}`, uuidv5.URL);
}

/** Parse a splits/secondary-map payload that may be a JSON string (DB TEXT
 *  column, possibly double-encoded by a legacy upload), an already-parsed
 *  object, or garbage. Invalid or empty input falls back to {}. */
export function parseSplitsText(raw: unknown): Record<string, string | null> {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return {};
    try {
      value = JSON.parse(trimmed);
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          return {};
        }
      }
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === "string" && v.length > 0 ? v : null;
  }
  return out;
}

/** Defensive parse of the secondary-map TEXT column. Same shape rules as the
 *  old localStorage reader: per-primary maps of value -> scheme key | null. */
export function parseSecondaryMapText(raw: unknown): SecondaryLensMap {
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return {};
    try {
      value = JSON.parse(trimmed);
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          return {};
        }
      }
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object") return {};
  const clean: SecondaryLensMap = {};
  for (const [primaryKey, perValue] of Object.entries(value as Record<string, unknown>)) {
    if (!perValue || typeof perValue !== "object") continue;
    clean[primaryKey] = {};
    for (const [colKey, secondaryKey] of Object.entries(perValue as Record<string, unknown>)) {
      clean[primaryKey][colKey] =
        typeof secondaryKey === "string" && secondaryKey.length > 0 ? secondaryKey : null;
    }
  }
  return clean;
}

export interface HorizonViewRow {
  id: string;
  user_id?: string;
  name: string;
  primary_scheme: string;
  splits: string | null;
  sort_by: string | null;
}

/** Map a horizon_views DB row onto the HorizonView shape. Returns null for
 *  invalid rows (bad JSON never throws — it falls back to no splits). */
export function rowToHorizonView(row: HorizonViewRow): HorizonView | null {
  if (!row || typeof row.id !== "string" || !row.id) return null;
  return sanitizeView({
    id: row.id,
    name: row.name,
    primary: row.primary_scheme,
    splits: parseSplitsText(row.splits),
    sortBy: row.sort_by === "priority" ? "priority" : "manual",
  });
}

/** Serialize a view for the horizon_views row (splits as JSON text). */
export function horizonViewToRow(view: HorizonView, userId: string): HorizonViewRow {
  return {
    id: view.id,
    user_id: userId,
    name: view.name,
    primary_scheme: view.primary,
    splits: JSON.stringify(view.splits ?? {}),
    sort_by: view.sortBy === "priority" ? "priority" : "manual",
  };
}

/** The single-statement default update: setting one default always clears
 *  the other so a default view and a default lens are mutually exclusive.
 *  Passing null clears both. */
export function exclusiveDefaults(input: { viewId?: string | null; lensId?: string | null }): {
  default_view_id: string | null;
  default_lens_id: string | null;
} {
  if (input.viewId) return { default_view_id: input.viewId, default_lens_id: null };
  if (input.lensId) return { default_view_id: null, default_lens_id: input.lensId };
  return { default_view_id: null, default_lens_id: null };
}

export interface LegacyHorizonImport {
  views: unknown;
  defaultViewId: string | null;
  secondaryMap: unknown;
}

export interface LegacyImportPlan {
  /** Valid views to INSERT OR IGNORE (idempotent on re-run / multi-device). */
  viewsToInsert: HorizonView[];
  /** Only true when the DB has no default yet — never overwrites remote data. */
  adoptDefault: string | null;
  /** Only non-null when the DB map is empty — never overwrites remote data. */
  adoptSecondaryMap: SecondaryLensMap | null;
}

/** Pure mapping for the one-time localStorage import. Re-running with the
 *  same legacy payload yields the same plan (INSERT OR IGNORE makes the
 *  view inserts idempotent); remote data is never overwritten. */
export function planLegacyImport(
  legacy: LegacyHorizonImport,
  remote: { viewCount: number; hasDefault: boolean; hasSecondaryMap: boolean },
): LegacyImportPlan {
  const parsed = Array.isArray(legacy.views) ? legacy.views : [];
  const viewsToInsert: HorizonView[] = [];
  for (const raw of parsed) {
    const v = sanitizeView(raw);
    if (v) viewsToInsert.push(v);
  }
  const knownIds = new Set(viewsToInsert.map((v) => v.id));
  const adoptDefault =
    !remote.hasDefault && legacy.defaultViewId && knownIds.has(legacy.defaultViewId)
      ? legacy.defaultViewId
      : null;
  const parsedMap = parseSecondaryMapText(legacy.secondaryMap);
  const adoptSecondaryMap =
    !remote.hasSecondaryMap && Object.keys(parsedMap).length > 0 ? parsedMap : null;
  return { viewsToInsert, adoptDefault, adoptSecondaryMap };
}

/** Short summary for view lists, e.g. "Term · split: Priority (3)". */
export function summarizeHorizonView(
  view: HorizonView,
  labelOf: (schemeKey: string) => string | null,
): string {
  const primary = labelOf(view.primary) ?? view.primary;
  const secondaries = Object.values(view.splits).filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  const sort = view.sortBy === "priority" ? " · priority" : "";
  if (secondaries.length === 0) return `${primary} · no splits${sort}`;
  const distinct = [...new Set(secondaries.map((s) => labelOf(s) ?? s))];
  if (distinct.length === 1)
    return `${primary} · split: ${distinct[0]} (${secondaries.length})${sort}`;
  return `${primary} · ${secondaries.length} splits${sort}`;
}

/** Merge a view's splits into the secondary map under its primary scheme. */
export function applyViewToSecondaryMap(
  view: HorizonView,
  prev: SecondaryLensMap,
): SecondaryLensMap {
  return { ...prev, [view.primary]: { ...(prev[view.primary] ?? {}), ...view.splits } };
}

/** Snapshot current splits (per column group key) for saving as a view. */
export function snapshotSplits(
  columnKeys: (string | null)[],
  secondaryKeyOf: (colKey: string | null) => string | null,
): Record<string, string | null> {
  const splits: Record<string, string | null> = {};
  for (const key of columnKeys) {
    splits[viewColumnKey(key)] = secondaryKeyOf(key) ?? null;
  }
  return splits;
}

/** True when the live lens/splits differ from the view definition. */
export function isViewDirty(
  view: HorizonView,
  lensKey: string,
  columnKeys: (string | null)[],
  secondaryKeyOf: (colKey: string | null) => string | null,
  sortBy: "manual" | "priority" = "manual",
): boolean {
  if (view.primary !== lensKey) return true;
  if ((view.sortBy ?? "manual") !== sortBy) return true;
  for (const key of columnKeys) {
    const live = secondaryKeyOf(key) ?? null;
    const saved = view.splits[viewColumnKey(key)] ?? null;
    if (live !== saved) return true;
  }
  return false;
}

export function newHorizonViewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `view-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
