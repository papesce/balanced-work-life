import type { ProjectViewMode } from "@/stores/uiPrefsStore";

/** Width below which the side-by-side split is disabled (mirrors AppShell). */
export const SPLIT_MIN_WIDTH = 1024;

/** Clamp a split ratio to a usable pane range. Falls back to 35 on garbage. */
export function clampSplitRatio(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 35;
  return Math.min(80, Math.max(10, n));
}

/**
 * Resolve which layout to render. Narrow screens force a single pane:
 * split falls back to the given single-pane mode (default "list").
 */
export function resolveEffectiveMode(
  mode: ProjectViewMode,
  width: number,
  narrowFallback: Exclude<ProjectViewMode, "split"> = "list",
): Exclude<ProjectViewMode, "split"> | "split" {
  if (mode === "split" && width < SPLIT_MIN_WIDTH) return narrowFallback;
  return mode;
}
