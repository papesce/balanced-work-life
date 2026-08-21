import { AREA_ORDER, DEFAULT_TARGETS } from "@/lib/constants";
import { LifeArea } from "@/lib/types";

const APP_STORAGE_KEYS = [
  "brainstorm-tree-overrides",
  "horizon-tree-overrides",
  "daily-planner-area-targets",
  "sidebar-collapsed",
  "planner-right-col-width",
  "timeline-prefs",
] as const;

export type AppStorageKey = (typeof APP_STORAGE_KEYS)[number];

export const STORAGE_KEYS = {
  brainstormTreeOverrides: "brainstorm-tree-overrides",
  horizonTreeOverrides: "horizon-tree-overrides",
  dailyPlannerAreaTargets: "daily-planner-area-targets",
  sidebarCollapsed: "sidebar-collapsed",
  plannerRightColWidth: "planner-right-col-width",
  timelinePrefs: "timeline-prefs",
} as const satisfies Record<string, AppStorageKey>;

export function readRawString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRawString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export function readJson<T>(key: string): T | null {
  const raw = readRawString(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeRawString(key, JSON.stringify(value));
}

export function listAppStorage(): Record<AppStorageKey, string | null> {
  const entries = APP_STORAGE_KEYS.map((key) => [key, readRawString(key)] as const);
  return Object.fromEntries(entries) as Record<AppStorageKey, string | null>;
}

export function clearAppStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of APP_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
}

export type TreeOverrideState = "expanded" | "collapsed";

export function readTreeOverrides(key: AppStorageKey): Map<string, TreeOverrideState> {
  const parsed = readJson<Record<string, TreeOverrideState>>(key) ?? {};
  return new Map(Object.entries(parsed));
}

export function writeTreeOverrides(
  key: AppStorageKey,
  overrides: Map<string, TreeOverrideState>,
): void {
  writeJson(key, Object.fromEntries(overrides));
}

export function loadAreaTargets(): Record<LifeArea, number> {
  const targets = { ...DEFAULT_TARGETS };
  const stored =
    readJson<Partial<Record<LifeArea, number>>>(STORAGE_KEYS.dailyPlannerAreaTargets) ?? {};
  for (const area of AREA_ORDER) {
    const value = stored[area];
    if (typeof value === "number" && Number.isFinite(value)) {
      targets[area] = value;
    }
  }
  return targets;
}
