import type { WeekCardPreview } from "@/components/timeline/WeekStripView";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";
import { getDayOccurrences, isActiveOccurrence } from "@/lib/tasks/rescheduleTask";
import { addDays, addMonths, daysBetween, getDatesRange } from "@/lib/dateUtils";
import { STORAGE_KEYS, readJson } from "@/lib/storage";
import type { Idea } from "@/lib/types";

export interface TimelinePreset {
  id: string;
  label: string;
  description: string;
  group: string;
  before: string;
  after: string;
  beforeDays?: number;
  afterDays?: number;
  beforeMonths?: number;
  afterMonths?: number;
}

export const TIMELINE_PRESETS: readonly TimelinePreset[] = [
  {
    id: "focus",
    label: "Focus",
    description: "A narrow window around today",
    group: "Short",
    before: "3 days",
    after: "2 weeks",
    beforeDays: 3,
    afterDays: 14,
  },
  {
    id: "planning",
    label: "Planning",
    description: "Near-term planning",
    group: "Medium",
    before: "1 week",
    after: "1 month",
    beforeDays: 7,
    afterMonths: 1,
  },
  {
    id: "review",
    label: "Review",
    description: "Step back and review recent work",
    group: "Long",
    before: "1 month",
    after: "3 months",
    beforeMonths: 1,
    afterMonths: 3,
  },
  {
    id: "horizon",
    label: "Horizon",
    description: "Long-range visibility",
    group: "Extended",
    before: "3 months",
    after: "6 months",
    beforeMonths: 3,
    afterMonths: 6,
  },
] as const;

export type TimelinePresetId = (typeof TIMELINE_PRESETS)[number]["id"];

export const DEFAULT_PRESET: TimelinePresetId = "focus";
export const MAX_SHOW_ALL_DAYS = 60;
export const FOCUS_BACK_DAYS = 7;
export const FOCUS_FORWARD_DAYS = 31;

export type RenderUnit = { kind: "day"; date: string } | { kind: "gap"; count: number };

export type TimelineView = "agenda" | "week" | "month";

export interface TimelinePrefs {
  filter: "all" | "deferred";
  preset: TimelinePresetId;
  view: TimelineView;
  weekCardPreview?: WeekCardPreview;
  pastRange?: string;
  futureRange?: string;
}

const WEEK_CARD_PREVIEW_IDS: WeekCardPreview[] = ["top", "times", "status", "priority"];

export function loadTimelinePrefs(): TimelinePrefs {
  const stored = readJson<Partial<TimelinePrefs>>(STORAGE_KEYS.timelinePrefs) ?? {};
  const presetIds: string[] = TIMELINE_PRESETS.map((r) => r.id);
  const legacyPreset = stored.preset as string | undefined;
  const legacyPast = stored.pastRange as string | undefined;
  const legacyFuture = stored.futureRange as string | undefined;
  const migratedPreset =
    legacyPast === "3days" && legacyFuture === "2weeks"
      ? "focus"
      : legacyPast === "week" && legacyFuture === "month"
        ? "planning"
        : legacyPast === "month" && legacyFuture === "quarter"
          ? "review"
          : legacyPast === "quarter" && legacyFuture === "6months"
            ? "horizon"
            : undefined;
  return {
    filter: stored.filter === "deferred" ? "deferred" : "all",
    preset: presetIds.includes(legacyPreset ?? "")
      ? (legacyPreset as TimelinePresetId)
      : (migratedPreset ?? DEFAULT_PRESET),
    view: stored.view === "week" || stored.view === "month" ? stored.view : "agenda",
    weekCardPreview: WEEK_CARD_PREVIEW_IDS.includes(stored.weekCardPreview as WeekCardPreview)
      ? (stored.weekCardPreview as WeekCardPreview)
      : "top",
  };
}

function presetById(id: string): TimelinePreset {
  return TIMELINE_PRESETS.find((r) => r.id === id) ?? TIMELINE_PRESETS[0];
}

function beforeDaysOf(preset: TimelinePreset, anchor: string): number {
  return preset.beforeMonths
    ? daysBetween(addMonths(anchor, -preset.beforeMonths), anchor)
    : (preset.beforeDays ?? 0);
}

function afterDaysOf(preset: TimelinePreset, anchor: string): number {
  return preset.afterMonths
    ? daysBetween(anchor, addMonths(anchor, preset.afterMonths))
    : (preset.afterDays ?? 0);
}

export function getLookbackForward(
  presetId: TimelinePresetId,
  anchor: string,
): { lookbackDays: number; forwardDays: number; extendedRange: boolean } {
  const selected = presetById(presetId);
  const lookbackDays = selected.beforeMonths
    ? daysBetween(addMonths(anchor, -selected.beforeMonths), anchor)
    : (selected.beforeDays ?? 3);
  const forwardDays = selected.afterMonths
    ? daysBetween(anchor, addMonths(anchor, selected.afterMonths))
    : (selected.afterDays ?? 14);
  return { lookbackDays, forwardDays, extendedRange: lookbackDays !== 3 || forwardDays !== 14 };
}

export function getOccurrencesForDates(
  tasks: Idea[],
  dates: string[],
  today: string,
  effectiveFilter: "all" | "deferred",
): Record<string, DayOccurrence[]> {
  const map: Record<string, DayOccurrence[]> = {};
  for (const date of dates) {
    const occurrences = getDayOccurrences(tasks, date, today, true);
    map[date] =
      effectiveFilter === "deferred" && date <= today
        ? occurrences.filter(isActiveOccurrence)
        : occurrences;
  }
  return map;
}

export function getRangeCounts(
  tasks: Idea[],
  anchor: string,
  today: string,
  effectiveFilter: "all" | "deferred",
): { past: Record<string, number>; future: Record<string, number> } {
  const dateCounts: Record<string, number> = {};
  const maxBeforeDays = Math.max(...TIMELINE_PRESETS.map((r) => beforeDaysOf(r, anchor)));
  const maxAfterDays = Math.max(...TIMELINE_PRESETS.map((r) => afterDaysOf(r, anchor)));
  const spanDates = getDatesRange(maxBeforeDays, maxAfterDays, anchor);
  for (const date of spanDates) {
    const occs = getDayOccurrences(tasks, date, today, true);
    dateCounts[date] =
      effectiveFilter === "deferred" && date <= today
        ? occs.filter(isActiveOccurrence).length
        : occs.length;
  }
  const countPast = (days: number) =>
    getDatesRange(days, 0, anchor).reduce((n, d) => (d < anchor ? n + (dateCounts[d] ?? 0) : n), 0);
  const countFuture = (days: number) =>
    getDatesRange(0, days, anchor).reduce((n, d) => (d > anchor ? n + (dateCounts[d] ?? 0) : n), 0);
  const past: Record<string, number> = {};
  const future: Record<string, number> = {};
  for (const r of TIMELINE_PRESETS) {
    past[r.id] = countPast(beforeDaysOf(r, anchor));
    future[r.id] = countFuture(afterDaysOf(r, anchor));
  }
  return { past, future };
}

export function getRangeSpans(anchor: string): Record<string, string> {
  const formatSpan = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const spans: Record<string, string> = {};
  for (const r of TIMELINE_PRESETS) {
    const before = r.beforeMonths
      ? addMonths(anchor, -r.beforeMonths)
      : addDays(anchor, -(r.beforeDays ?? 0));
    const after = r.afterMonths
      ? addMonths(anchor, r.afterMonths)
      : addDays(anchor, r.afterDays ?? 0);
    spans[r.id] = `${formatSpan(before)} – ${formatSpan(after)}`;
  }
  return spans;
}

export function buildRenderPlan(
  dates: string[],
  occurrencesByDate: Record<string, DayOccurrence[]>,
  extendedRange: boolean,
  anchor: string,
): RenderUnit[] {
  if (!extendedRange || dates.length <= MAX_SHOW_ALL_DAYS) {
    return dates.map((d) => ({ kind: "day", date: d }));
  }
  const anchorIndex = dates.indexOf(anchor);
  const plan: RenderUnit[] = [];
  let gapCount = 0;
  const flushGap = () => {
    if (gapCount > 0) {
      plan.push({ kind: "gap", count: gapCount });
      gapCount = 0;
    }
  };
  dates.forEach((date, i) => {
    const hasOccurrences = (occurrencesByDate[date]?.length ?? 0) > 0;
    const withinFocus =
      anchorIndex >= 0 &&
      i >= anchorIndex - FOCUS_BACK_DAYS &&
      i <= anchorIndex + FOCUS_FORWARD_DAYS;
    if (hasOccurrences || withinFocus) {
      flushGap();
      plan.push({ kind: "day", date });
    } else {
      gapCount += 1;
    }
  });
  flushGap();
  return plan;
}

/** Dropdown badge text per preset: "N before · M after". */
export function getDropdownCounts(rangeCounts: {
  past: Record<string, number>;
  future: Record<string, number>;
}): Record<string, string> {
  return Object.fromEntries(
    TIMELINE_PRESETS.map((r) => [
      r.id,
      `${rangeCounts.past[r.id] ?? 0} before · ${rangeCounts.future[r.id] ?? 0} after`,
    ]),
  ) as Record<string, string>;
}
