"use client";

import { useMemo } from "react";
import { getDayOccurrences } from "@/lib/tasks/rescheduleTask";
import { AREA_ORDER } from "@/lib/constants";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";

interface UsePlannerDayParams {
  ideas: Idea[];
  activeDate: string;
  today: string;
  hideCompleted: boolean;
  getTagsForIdea: (ideaId: string) => Tag[];
}

const EMPTY_AREAS: LifeArea[] = ["life"];

function emptyAreaMinutes(): Record<
  LifeArea,
  { pending: number; scheduled: number; done: number }
> {
  return {
    work: { pending: 0, scheduled: 0, done: 0 },
    health: { pending: 0, scheduled: 0, done: 0 },
    relationships: { pending: 0, scheduled: 0, done: 0 },
    growth: { pending: 0, scheduled: 0, done: 0 },
    finances: { pending: 0, scheduled: 0, done: 0 },
    life: { pending: 0, scheduled: 0, done: 0 },
  };
}

function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

function effectiveAreasOf(tags: Tag[]): LifeArea[] {
  const areas = getAreasForIdea(tags);
  return areas.length > 0 ? areas : EMPTY_AREAS;
}

/**
 * Derived day model for the Daily Planner: date slices, per-area minute
 * counts, balance-ring totals, and the pending/done groupings shared by
 * the render loop and the dnd-kit provider. Memo-only, no effects.
 */
export function usePlannerDay({
  ideas,
  activeDate,
  today,
  hideCompleted,
  getTagsForIdea,
}: UsePlannerDayParams) {
  const taskIdeas = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);
  const scheduledTaskIdeas = useMemo(
    () => taskIdeas.filter((i) => i.status !== "completed" && i.status !== "archived"),
    [taskIdeas],
  );

  const doneOnDate = useMemo(
    () => taskIdeas.filter((i) => i.status === "completed" && i.scheduled_date === activeDate),
    [taskIdeas, activeDate],
  );

  const visibleDoneOnDate = useMemo(
    () => (hideCompleted ? [] : doneOnDate),
    [doneOnDate, hideCompleted],
  );

  const pendingOnDate = useMemo(
    () => scheduledTaskIdeas.filter((i) => i.scheduled_date === activeDate && !i.scheduled_time),
    [scheduledTaskIdeas, activeDate],
  );

  const scheduledOnDate = useMemo(
    () => scheduledTaskIdeas.filter((i) => i.scheduled_date === activeDate && !!i.scheduled_time),
    [scheduledTaskIdeas, activeDate],
  );

  const deferredOnDate = useMemo(
    () => getDayOccurrences(taskIdeas, activeDate, today).filter((o) => o.isHistorical),
    [taskIdeas, activeDate, today],
  );

  const allTasksForTimeline = useMemo(
    () => [...pendingOnDate, ...scheduledOnDate, ...doneOnDate],
    [pendingOnDate, scheduledOnDate, doneOnDate],
  );

  const areaTaskCounts = useMemo(() => {
    const counts = emptyAreaMinutes();
    const duration = (t: Idea) => t.duration_minutes ?? 30;
    for (const t of pendingOnDate) {
      for (const a of effectiveAreasOf(getTagsForIdea(t.id))) counts[a].pending += duration(t);
    }
    for (const t of scheduledOnDate) {
      for (const a of effectiveAreasOf(getTagsForIdea(t.id))) counts[a].scheduled += duration(t);
    }
    for (const t of doneOnDate) {
      for (const a of effectiveAreasOf(getTagsForIdea(t.id))) counts[a].done += duration(t);
    }
    return counts;
  }, [pendingOnDate, scheduledOnDate, doneOnDate, getTagsForIdea]);

  const balanceRingCounts = useMemo(() => {
    const counts = emptyAreaCounts();
    for (const area of AREA_ORDER)
      counts[area] =
        areaTaskCounts[area].pending + areaTaskCounts[area].scheduled + areaTaskCounts[area].done;
    return counts;
  }, [areaTaskCounts]);

  const dayIsEmpty =
    pendingOnDate.length === 0 && scheduledOnDate.length === 0 && doneOnDate.length === 0;

  // Per-area groupings shared by the render loop and the dnd-kit provider
  // (reorder + drop-target resolution).
  const pendingByArea = useMemo(() => {
    const grouped = Object.fromEntries(AREA_ORDER.map((a) => [a, [] as Idea[]])) as Record<
      LifeArea,
      Idea[]
    >;
    for (const t of [...pendingOnDate, ...scheduledOnDate]) {
      for (const a of effectiveAreasOf(getTagsForIdea(t.id))) grouped[a].push(t);
    }
    return grouped;
  }, [pendingOnDate, scheduledOnDate, getTagsForIdea]);

  const doneByArea = useMemo(() => {
    const grouped = Object.fromEntries(AREA_ORDER.map((a) => [a, [] as Idea[]])) as Record<
      LifeArea,
      Idea[]
    >;
    for (const t of visibleDoneOnDate) {
      for (const a of effectiveAreasOf(getTagsForIdea(t.id))) grouped[a].push(t);
    }
    return grouped;
  }, [visibleDoneOnDate, getTagsForIdea]);

  return {
    taskIdeas,
    scheduledTaskIdeas,
    doneOnDate,
    visibleDoneOnDate,
    pendingOnDate,
    scheduledOnDate,
    deferredOnDate,
    allTasksForTimeline,
    areaTaskCounts,
    balanceRingCounts,
    dayIsEmpty,
    pendingByArea,
    doneByArea,
  };
}
