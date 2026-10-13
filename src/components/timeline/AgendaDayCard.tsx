"use client";

import { useLayoutEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { DateChip } from "@/components/shared/DateChip";
import { DayTaskList } from "@/components/timeline/DayTaskList";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import {
  formatDayTitle,
  formatTimelineDate,
  getTimelineKicker,
} from "@/components/timeline/timelineUtils";
import { isPast, isPlanDate } from "@/lib/dateUtils";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";
import type { Idea, LifeArea } from "@/lib/types";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) =>
    ({
      opacity: 1,
      y: 0,
      transition: { delay: Math.min(i, 5) * 0.06, duration: 0.35, ease: "easeOut" },
    }) as const,
};

function AnchorReadyMarker({
  date,
  onReady,
  enabled,
  children,
}: {
  date: string;
  onReady: (date: string, node: HTMLDivElement) => void;
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (enabled && ref.current) onReady(date, ref.current);
  }, [date, enabled, onReady]);

  return <div ref={ref}>{children}</div>;
}

export function AgendaGap({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-gray-300 uppercase dark:text-gray-600">
        <div className="h-px w-8 bg-black/10 dark:bg-white/10" />+{count} empty{" "}
        {count === 1 ? "day" : "days"}
        <div className="h-px w-8 bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

type SharedDayProps = Pick<
  ComponentProps<typeof DayTaskList>,
  | "onReorder"
  | "onDone"
  | "onUndone"
  | "onUpdate"
  | "onReschedule"
  | "onMove"
  | "ideas"
  | "links"
  | "onCreateLink"
  | "onDeleteLink"
  | "onGoToDate"
  | "allTags"
  | "getTagsForIdea"
  | "onAddTag"
  | "onRemoveTag"
  | "onCreateTag"
>;

interface AgendaDayCardProps extends SharedDayProps {
  index: number;
  date: string;
  anchor: string;
  today: string;
  tomorrow: string;
  occurrences: DayOccurrence[];
  effectiveFilter: "all" | "deferred";
  quickAddArea: LifeArea | null;
  onQuickAddAreaChange: (area: LifeArea | null) => void;
  onQuickAdd: (text: string, date: string, area: LifeArea | null) => Promise<void>;
  onSmartSort: (tasks: Idea[]) => void;
  onPlan: (date: string) => void;
  onAnchorReady: (date: string, node: HTMLDivElement) => void;
  onTodayReady: (date: string, node: HTMLDivElement) => void;
}

export function AgendaDayCard({
  index,
  date,
  anchor,
  today,
  tomorrow,
  occurrences,
  effectiveFilter,
  quickAddArea,
  onQuickAddAreaChange,
  onQuickAdd,
  onSmartSort,
  onPlan,
  onAnchorReady,
  onTodayReady,
  ...dayListProps
}: AgendaDayCardProps) {
  const dayOccurrences = occurrences;
  const dayTasks = dayOccurrences.filter((o) => !o.isHistorical).map((o) => o.task);
  const isAnchorDate = date === anchor;
  const isTodayDate = date === today;
  const dateLabel = formatTimelineDate(date);
  const dayTitle = formatDayTitle(date, "agenda");
  const timelineKicker = getTimelineKicker(date, today, tomorrow);
  const unresolvedCount = dayOccurrences.filter(
    (o) =>
      !o.isHistorical &&
      o.task.status !== "completed" &&
      o.task.status !== "cancelled" &&
      o.task.status !== "missed" &&
      isPast(date),
  ).length;

  return (
    <motion.section
      key={date}
      id={`day-${date}`}
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <AnchorReadyMarker date={date} enabled={isAnchorDate} onReady={onAnchorReady}>
        <AnchorReadyMarker date={date} enabled={isTodayDate} onReady={onTodayReady}>
          <div
            id={isAnchorDate ? "anchor-card" : undefined}
            className={`glass-card rounded-[20px] transition-all${
              isTodayDate
                ? "border-l-4! border-l-violet-500! bg-violet-50/70! shadow-lg! shadow-violet-500/10! dark:bg-violet-500/10!"
                : ""
            }${
              isAnchorDate && !isTodayDate
                ? "shadow-lg! ring-2! ring-violet-300/80! dark:ring-violet-400/60!"
                : ""
            }`}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span
                    className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                      isAnchorDate
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {timelineKicker}
                  </span>
                  <span className="flex items-center gap-2">
                    <DateChip
                      dayNum={Number(date.slice(8, 10))}
                      isToday={isTodayDate}
                      isSelected={isAnchorDate}
                      size="md"
                    />
                    <span className="text-[22px] leading-tight font-bold text-gray-900 dark:text-gray-100">
                      {dayTitle.weekday}
                      <span className="ml-2 align-middle text-sm font-semibold text-gray-400 dark:text-gray-500">
                        {dayTitle.month}
                      </span>
                    </span>
                  </span>
                </div>
                {unresolvedCount > 0 && (
                  <span className="rounded-full bg-red-100/80 px-2.5 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {unresolvedCount} unresolved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <MiniBalanceBar
                  tasks={dayTasks}
                  getTagsForIdea={dayListProps.getTagsForIdea}
                  date={date}
                />
                {dayTasks.length > 0 && (
                  <button
                    onClick={() => onSmartSort(dayTasks)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-all hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                    title="Sort tasks by priority score (effort × impact × urgency)"
                  >
                    <Sparkles size={12} />
                    <span className="hidden sm:inline">Smart Sort</span>
                  </button>
                )}
                <button onClick={() => onPlan(date)} className="focus-button">
                  Plan
                </button>
              </div>
            </div>

            <div className="px-5 pb-2">
              {dayOccurrences.length === 0 ? (
                <p className="py-1 text-xs text-gray-400 italic dark:text-gray-500">
                  {effectiveFilter === "deferred"
                    ? "No deferred tasks this day"
                    : "No tasks planned"}
                </p>
              ) : (
                <DayTaskList occurrences={dayOccurrences} today={today} {...dayListProps} />
              )}
            </div>

            {effectiveFilter === "all" || isPlanDate(date) ? (
              <div className="px-5 pt-1 pb-4">
                <QuickAddInput
                  placeholder={`+ Add task for ${isTodayDate ? "today" : dateLabel}...`}
                  area={quickAddArea}
                  onAreaChange={onQuickAddAreaChange}
                  onAdd={(text) => onQuickAdd(text, date, quickAddArea)}
                  suggestFrom={dayListProps.ideas}
                />
              </div>
            ) : null}
          </div>
        </AnchorReadyMarker>
      </AnchorReadyMarker>
    </motion.section>
  );
}
