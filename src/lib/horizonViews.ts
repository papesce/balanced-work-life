import { readJson, writeJson } from "@/lib/storage";
import type { SecondaryLensMap } from "@/lib/storage";

export const HORIZON_VIEWS_KEY = "horizon-views-v1";
export const HORIZON_ACTIVE_VIEW_KEY = "horizon-active-view-id";
export const HORIZON_DEFAULT_VIEW_KEY = "horizon-default-view-id";

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

function sanitizeView(raw: unknown): HorizonView | null {
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

export function readHorizonViews(): HorizonView[] {
  const parsed = readJson<unknown[]>(HORIZON_VIEWS_KEY);
  if (!Array.isArray(parsed)) return [];
  const out: HorizonView[] = [];
  for (const raw of parsed) {
    const v = sanitizeView(raw);
    if (v) out.push(v);
  }
  return out;
}

export function writeHorizonViews(views: HorizonView[]): void {
  writeJson(HORIZON_VIEWS_KEY, views);
}

export function readActiveHorizonViewId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(HORIZON_ACTIVE_VIEW_KEY);
  } catch {
    return null;
  }
}

export function writeActiveHorizonViewId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(HORIZON_ACTIVE_VIEW_KEY, id);
    else window.localStorage.removeItem(HORIZON_ACTIVE_VIEW_KEY);
  } catch {}
}

export function readDefaultHorizonViewId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(HORIZON_DEFAULT_VIEW_KEY);
  } catch {
    return null;
  }
}

export function writeDefaultHorizonViewId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(HORIZON_DEFAULT_VIEW_KEY, id);
    else window.localStorage.removeItem(HORIZON_DEFAULT_VIEW_KEY);
  } catch {}
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
