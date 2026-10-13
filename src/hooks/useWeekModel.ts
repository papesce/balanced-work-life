"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PriorityValue } from "@/components/shared/PriorityChip";
import type { useClassifications } from "@/hooks/useClassifications";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";

interface UseWeekModelParams {
  weekDates: string[];
  anchor: string;
  today: string;
  occurrencesByDate: Record<string, DayOccurrence[]>;
  getOptionForIdea: ReturnType<typeof useClassifications>["getOptionForIdea"];
}

/**
 * Week strip derivations: fallback selection, priority lookup, label,
 * totals, selected-day occurrences, and detail auto-scroll.
 */
export function useWeekModel({
  weekDates,
  anchor,
  today,
  occurrencesByDate,
  getOptionForIdea,
}: UseWeekModelParams) {
  // Anchor (?date=) doubles as the selected day: week is derived from it upstream,
  // so selection survives refresh / back-forward without an extra param.
  const selectedDate = weekDates.includes(anchor)
    ? anchor
    : weekDates.includes(today)
      ? today
      : weekDates[0];
  const priorityOf = (ideaId: string): PriorityValue =>
    (getOptionForIdea(ideaId, "priority")?.value ?? null) as PriorityValue;

  const weekLabel = (() => {
    const first = new Date(weekDates[0] + "T00:00:00");
    const last = new Date(weekDates[weekDates.length - 1] + "T00:00:00");
    const sameMonth = first.getMonth() === last.getMonth();
    const opts = { month: "short", day: "numeric" } as const;
    return sameMonth
      ? `${first.toLocaleDateString(undefined, { month: "long" })} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
      : `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}, ${last.getFullYear()}`;
  })();

  const containsToday = weekDates.includes(today);
  const weekTotals = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const d of weekDates) {
      const occs = (occurrencesByDate[d] ?? []).filter((o) => !o.isHistorical);
      total += occs.length;
      done += occs.filter(
        (o) =>
          o.task.status === "completed" ||
          o.task.status === "cancelled" ||
          o.task.status === "missed",
      ).length;
    }
    return { total, done };
  }, [occurrencesByDate, weekDates]);

  const selectedOccurrences = useMemo(
    () => occurrencesByDate[selectedDate] ?? [],
    [occurrencesByDate, selectedDate],
  );
  const selectedDayTasks = useMemo(
    () => selectedOccurrences.filter((o) => !o.isHistorical).map((o) => o.task),
    [selectedOccurrences],
  );
  const detailRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedDate]);

  return {
    selectedDate,
    priorityOf,
    weekLabel,
    containsToday,
    weekTotals,
    selectedOccurrences,
    selectedDayTasks,
    detailRef,
  };
}
