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
  /** Human-friendly description of the lens. */
  description: string;
  /** Column order: JSON array of option values defining column sort. */
  column_order: string[];
  /** Tiebreakers: JSON array of {scheme, direction} for in-column sorting. */
  tiebreakers: { scheme: string; direction: "asc" | "desc" }[];
  /** Column group key -> secondary scheme key (null = no split). */
  splits: Record<string, string | null>;
  /** Sort items within each group. */
  sortBy?: "manual" | "priority";
  /** Is this a built-in lens (seeded from constants) vs user-created. */
  is_builtin: boolean;
}

/** Parse a JSON-text string array (DB TEXT column) or an already-parsed
 *  array. Invalid input falls back to []. */
export function parseStringArrayText(raw: unknown): string[] {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export interface HorizonTiebreaker {
  scheme: string;
  direction: "asc" | "desc";
}

/** Parse a JSON-text tiebreaker array or an already-parsed array.
 *  Invalid entries are dropped; invalid input falls back to []. */
export function parseTiebreakersText(raw: unknown): HorizonTiebreaker[] {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: HorizonTiebreaker[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    if (typeof t.scheme !== "string" || !t.scheme) continue;
    out.push({ scheme: t.scheme, direction: t.direction === "desc" ? "desc" : "asc" });
  }
  return out;
}

/** Deterministic horizon_views row id for a seeded built-in lens, per user
 *  so every device converges (same pattern as scheme seeds). */
export function horizonLensSeedId(userId: string, lensKey: string): string {
  return uuidv5(`balanced-work-life:horizon-lens:${userId}:${lensKey}`, uuidv5.URL);
}

export function sanitizeView(raw: unknown): HorizonView | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return null;
  if (typeof v.name !== "string" || !v.name.trim()) return null;
  if (typeof v.primary !== "string" || !v.primary) return null;
  // description / column_order / tiebreakers / is_builtin are optional for
  // backward compatibility with rows written before the editable-lens
  // migration — missing values fall back to empty defaults.
  const description = typeof v.description === "string" ? v.description : "";
  const columnOrder = parseStringArrayText(v.column_order ?? v.columnOrder ?? []);
  const tiebreakers = parseTiebreakersText(v.tiebreakers ?? []);
  const splits: Record<string, string | null> = {};
  const rawSplits = v.splits;
  if (rawSplits && typeof rawSplits === "object") {
    for (const [k, val] of Object.entries(rawSplits as Record<string, unknown>)) {
      splits[k] = typeof val === "string" && val.length > 0 ? val : null;
    }
  }
  const isBuiltin = v.is_builtin === true;
  return {
    id: v.id,
    name: v.name.trim(),
    primary: v.primary,
    description,
    column_order: columnOrder,
    tiebreakers,
    splits,
    sortBy: v.sortBy === "priority" ? "priority" : "manual",
    is_builtin: isBuiltin,
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
  description?: string | null;
  column_order?: string | null;
  tiebreakers?: string | null;
  splits: string | null;
  sort_by: string | null;
  is_builtin?: boolean | number | null;
}

/** Map a horizon_views DB row onto the HorizonView shape. Returns null for
 *  invalid rows (bad JSON never throws — it falls back to empty). */
export function rowToHorizonView(row: HorizonViewRow): HorizonView | null {
  if (!row || typeof row.id !== "string" || !row.id) return null;
  return sanitizeView({
    id: row.id,
    name: row.name,
    primary: row.primary_scheme,
    description: row.description ?? "",
    column_order: row.column_order ?? "[]",
    tiebreakers: row.tiebreakers ?? "[]",
    splits: parseSplitsText(row.splits),
    sortBy: row.sort_by === "priority" ? "priority" : "manual",
    is_builtin: row.is_builtin === true || row.is_builtin === 1,
  });
}

/** Serialize a view for the horizon_views row (JSON payloads as TEXT). */
export function horizonViewToRow(view: HorizonView, userId: string): HorizonViewRow {
  return {
    id: view.id,
    user_id: userId,
    name: view.name,
    primary_scheme: view.primary,
    description: view.description ?? "",
    column_order: JSON.stringify(view.column_order ?? []),
    tiebreakers: JSON.stringify(view.tiebreakers ?? []),
    splits: JSON.stringify(view.splits ?? {}),
    sort_by: view.sortBy === "priority" ? "priority" : "manual",
    is_builtin: view.is_builtin ?? false,
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
  // Legacy builtin views used ids like "seed-term": remap to a uuid so the
  // server upsert (uuid PK) accepts them instead of failing with 22P02.
  // originalId -> final id, so the legacy default can follow the remap.
  const idRemap = new Map<string, string>();
  for (const raw of parsed) {
    const v = sanitizeView(raw);
    if (!v) continue;
    const final = withServerCompatibleId(v);
    viewsToInsert.push(final);
    if (final.id !== v.id) idRemap.set(v.id, final.id);
  }
  const knownIds = new Set(viewsToInsert.map((v) => v.id));
  const rawDefault = legacy.defaultViewId;
  const resolvedDefault =
    rawDefault && idRemap.has(rawDefault) ? idRemap.get(rawDefault)! : rawDefault;
  const adoptDefault =
    !remote.hasDefault && resolvedDefault && knownIds.has(resolvedDefault) ? resolvedDefault : null;
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

/** Server id columns are uuid; legacy localStorage views used human-readable
 *  ids (e.g. "seed-term") that Postgres rejects with 22P02 and that would
 *  wedge the PowerSync upload queue behind a poisoned op. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Remap a view onto a server-compatible uuid when its id is a legacy
 *  human-readable string. Ids already in uuid form pass through untouched. */
export function withServerCompatibleId(view: HorizonView): HorizonView {
  if (isUuid(view.id)) return view;
  return { ...view, id: newHorizonViewId() };
}
