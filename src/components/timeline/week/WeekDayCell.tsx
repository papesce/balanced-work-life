"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { DateChip } from "@/components/shared/DateChip";
import type { PriorityValue } from "@/components/shared/PriorityChip";
import { WeekPreviewContent } from "@/components/timeline/week/weekPreviews";
import type { WeekCardPreview } from "@/components/timeline/WeekStripView";
import { isPast } from "@/lib/dateUtils";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";
import type { Tag } from "@/lib/types";
import {
  formatDayTitle,
  formatTaskCount,
  formatTimelineDate,
  getTimelineKicker,
} from "@/components/timeline/timelineUtils";
import { CalendarEventList } from "@/components/timeline/CalendarEventList";
import type { Idea } from "@/lib/types";

export function WeekDayCell({
  date,
  selected,
  today,
  tomorrow,
  occurrences,
  events,
  onSelectEvent,
  onSelect,
  getTagsForIdea,
  preview,
  priorityOf,
}: {
  date: string;
  selected: boolean;
  today: string;
  tomorrow: string;
  occurrences: DayOccurrence[];
  events: Idea[];
  onSelectEvent: (event: Idea) => void;
  onSelect: () => void;
  getTagsForIdea: (ideaId: string) => Tag[];
  preview: WeekCardPreview;
  priorityOf: (ideaId: string) => PriorityValue;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `week-day-${date}`, data: { date } });
  const current = useMemo(() => occurrences.filter((o) => !o.isHistorical), [occurrences]);
  const dayTasks = useMemo(() => current.map((o) => o.task), [current]);
  const done = current.filter(
    (o) =>
      o.task.status === "completed" || o.task.status === "cancelled" || o.task.status === "missed",
  ).length;
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const weekendClass =
    dayOfWeek === 6 ? "weekend-saturday" : dayOfWeek === 0 ? "weekend-sunday" : "";
  const weekdayClass =
    dayOfWeek === 6
      ? "text-slate-600 dark:text-slate-300"
      : dayOfWeek === 0
        ? "text-violet-600 dark:text-violet-300"
        : "text-gray-900 dark:text-gray-100";
  const isToday = date === today;
  const kicker = getTimelineKicker(date, today, tomorrow);
  const unresolvedCount = current.filter(
    (o) =>
      o.task.status !== "completed" &&
      o.task.status !== "cancelled" &&
      o.task.status !== "missed" &&
      isPast(date),
  ).length;

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${formatTimelineDate(date)}: ${done}/${current.length} done. Select to view tasks.`}
      className={`flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-2xl p-2.5 text-left transition-colors ${
        isOver
          ? "border border-violet-400 bg-violet-50 ring-2 ring-violet-500/40 dark:border-violet-500 dark:bg-violet-950/20"
          : selected
            ? "glass-card-anchor"
            : "glass-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      } ${!isOver && !selected ? weekendClass : ""}`}
    >
      <span className="flex items-center gap-1.5">
        <DateChip dayNum={Number(date.slice(8, 10))} isToday={isToday} isSelected={selected} />
        <span
          className={`truncate text-xs font-bold ${weekdayClass} ${selected && !isToday && dayOfWeek !== 6 ? "text-violet-700 dark:text-violet-300" : ""} ${isToday ? "underline decoration-violet-500 decoration-2 underline-offset-4" : ""}`}
        >
          {formatDayTitle(date, "week").weekday}
        </span>
      </span>
      {kicker && (
        <span className="text-[9px] font-semibold tracking-[0.12em] text-gray-400 uppercase dark:text-gray-500">
          {kicker}
        </span>
      )}
      <MiniBalanceBar tasks={dayTasks} getTagsForIdea={getTagsForIdea} date={date} />
      <CalendarEventList events={events} onSelect={onSelectEvent} compact maxItems={2} />
      <WeekPreviewContent
        current={current}
        preview={preview}
        priorityOf={priorityOf}
        unresolvedCount={unresolvedCount}
      />
      <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 tabular-nums dark:text-gray-400">
        <span className="rounded-full bg-black/[0.05] px-1.5 py-px dark:bg-white/[0.08]">
          {formatTaskCount(current.length)}
        </span>
        {current.length > 0 && (
          <span>
            {done}/{current.length} done
          </span>
        )}
        {unresolvedCount > 0 && (
          <span className="rounded-full bg-red-100/80 px-1.5 py-px text-[9px] text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {unresolvedCount}
          </span>
        )}
      </span>
    </div>
  );
}
