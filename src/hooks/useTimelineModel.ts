"use client";

import { useMemo } from "react";
import { getDatesRange, getMonthCalendarGrid, getWindowRange } from "@/lib/dateUtils";
import type { Idea } from "@/lib/types";
import {
  buildRenderPlan,
  getLookbackForward,
  getOccurrencesForDates,
  getRangeCounts,
  getRangeSpans,
  type TimelinePresetId,
} from "@/lib/timelinePresets";

interface UseTimelineModelParams {
  ideas: Idea[];
  anchor: string;
  today: string;
  preset: TimelinePresetId;
  filter: "all" | "deferred";
}

/**
 * Derived timeline data: date windows, per-date occurrences, range badges,
 * and the agenda render plan (day/gap collapsing for long ranges).
 * Memo-only, no effects.
 */
export function useTimelineModel({ ideas, anchor, today, preset, filter }: UseTimelineModelParams) {
  const { lookbackDays, forwardDays, extendedRange } = useMemo(
    () => getLookbackForward(preset, anchor),
    [preset, anchor],
  );
  const dates = useMemo(
    () => getDatesRange(lookbackDays, forwardDays, anchor),
    [lookbackDays, forwardDays, anchor],
  );
  const hasRevisitDates = dates.some((d) => d <= today);
  const effectiveFilter = hasRevisitDates ? filter : "all";
  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const monthGridDates = useMemo(() => getMonthCalendarGrid(anchor), [anchor]);
  const weekStart = useMemo(() => getWindowRange("week", anchor).start, [anchor]);
  const weekDates = useMemo(() => getDatesRange(0, 6, weekStart), [weekStart]);

  const occurrencesByDate = useMemo(() => {
    const allVisible = new Set<string>([...dates, ...monthGridDates, ...weekDates]);
    return getOccurrencesForDates(tasks, [...allVisible], today, effectiveFilter);
  }, [tasks, dates, monthGridDates, weekDates, today, effectiveFilter]);

  const rangeCounts = useMemo(
    () => getRangeCounts(tasks, anchor, today, effectiveFilter),
    [tasks, anchor, today, effectiveFilter],
  );

  const rangeSpans = useMemo(() => getRangeSpans(anchor), [anchor]);

  const renderPlan = useMemo(
    () => buildRenderPlan(dates, occurrencesByDate, extendedRange, anchor),
    [dates, occurrencesByDate, extendedRange, anchor],
  );

  const noDeferredActivity =
    effectiveFilter === "deferred" &&
    extendedRange &&
    !dates.some((d) => (occurrencesByDate[d]?.length ?? 0) > 0);

  return {
    lookbackDays,
    forwardDays,
    extendedRange,
    dates,
    hasRevisitDates,
    effectiveFilter,
    tasks,
    monthGridDates,
    weekStart,
    weekDates,
    occurrencesByDate,
    rangeCounts,
    rangeSpans,
    renderPlan,
    noDeferredActivity,
  };
}
