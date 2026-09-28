"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { addDays, getToday, isPast, isPlanDate } from "@/lib/dateUtils";
import { DayTaskList } from "./DayTaskList";
import { QuickAddInput } from "./QuickAddInput";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { formatTimelineDate, getTimelineKicker } from "./timelineUtils";

interface WeekStripViewProps {
  weekDates: string[];
  anchor: string;
  today: string;
  tomorrow: string;
  occurrencesByDate: Record<string, DayOccurrence[]>;
  showQuickAdd: (date: string) => boolean;
  onAnchorChange: (date: string) => void;
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas: Idea[];
  links: IdeaLink[];
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onGoToDate?: (date: string, taskId: string) => void;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  quickAddArea: LifeArea | null;
  onQuickAddAreaChange: (area: LifeArea | null) => void;
  onQuickAdd: (text: string, date: string) => Promise<void>;
  suggestFrom: Idea[];
}

export function WeekStripView(props: WeekStripViewProps) {
  const { weekDates, anchor, today, tomorrow } = props;
  const weekLabel = (() => {
    const first = new Date(weekDates[0] + "T00:00:00");
    const last = new Date(weekDates[weekDates.length - 1] + "T00:00:00");
    const sameMonth = first.getMonth() === last.getMonth();
    const opts = { month: "short", day: "numeric" } as const;
    return sameMonth
      ? `${first.toLocaleDateString(undefined, { month: "long" })} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`
      : `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}, ${last.getFullYear()}`;
  })();

  return (
    <div className="space-y-4">
      <div className="glass-card flex items-center justify-between rounded-[20px] px-4 py-2.5">
        <button
          onClick={() => props.onAnchorChange(addDays(anchor, -7))}
          aria-label="Previous week"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => props.onAnchorChange(getToday())}
          title="Jump to this week"
          className="text-sm font-bold text-gray-900 hover:text-violet-600 dark:text-gray-100 dark:hover:text-violet-400"
        >
          {weekLabel}
        </button>
        <button
          onClick={() => props.onAnchorChange(addDays(anchor, 7))}
          aria-label="Next week"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-2">
        {weekDates.map((date) => {
          const dayOccurrences = props.occurrencesByDate[date] ?? [];
          const dayTasks = dayOccurrences.filter((o) => !o.isHistorical).map((o) => o.task);
          const isAnchorDate = date === anchor;
          const isTodayDate = date === today;
          const unresolvedCount = dayOccurrences.filter(
            (o) =>
              !o.isHistorical &&
              o.task.status !== "completed" &&
              o.task.status !== "cancelled" &&
              isPast(date),
          ).length;
          return (
            <section
              key={date}
              id={`week-${date}`}
              className={`rounded-[20px] transition-all ${
                isAnchorDate ? "glass-card-anchor" : isTodayDate ? "glass-card-today" : "glass-card"
              }`}
            >
              <div className="flex flex-col gap-1 px-3 pt-3 pb-2">
                <span
                  className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${
                    isAnchorDate
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {getTimelineKicker(date, today, tomorrow)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-sm leading-tight font-bold text-gray-900 dark:text-gray-100">
                    {formatTimelineDate(date)}
                  </span>
                  {isTodayDate && (
                    <span className="rounded-full bg-emerald-100/80 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Today
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <MiniBalanceBar
                    tasks={dayTasks}
                    getTagsForIdea={props.getTagsForIdea}
                    date={date}
                  />
                  {unresolvedCount > 0 && (
                    <span className="rounded-full bg-red-100/80 px-1.5 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {unresolvedCount} unresolved
                    </span>
                  )}
                </span>
              </div>

              <div className="px-3 pb-1">
                {dayOccurrences.length === 0 ? (
                  <p className="py-1 text-[11px] text-gray-400 italic dark:text-gray-500">
                    No tasks planned
                  </p>
                ) : (
                  <DayTaskList
                    occurrences={dayOccurrences}
                    onReorder={props.onReorder}
                    onDone={props.onDone}
                    onUndone={props.onUndone}
                    onUpdate={props.onUpdate}
                    onReschedule={props.onReschedule}
                    onMove={props.onMove}
                    ideas={props.ideas}
                    links={props.links}
                    onCreateLink={props.onCreateLink}
                    onDeleteLink={props.onDeleteLink}
                    today={props.today}
                    onGoToDate={props.onGoToDate}
                    allTags={props.allTags}
                    getTagsForIdea={props.getTagsForIdea}
                    onAddTag={props.onAddTag}
                    onRemoveTag={props.onRemoveTag}
                    onCreateTag={props.onCreateTag}
                  />
                )}
              </div>

              {props.showQuickAdd(date) && (
                <div className="px-3 pt-1 pb-3">
                  <QuickAddInput
                    placeholder="+ Add task..."
                    area={props.quickAddArea}
                    onAreaChange={props.onQuickAddAreaChange}
                    onAdd={(text) => props.onQuickAdd(text, date)}
                    suggestFrom={props.suggestFrom}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function isQuickAddVisible(date: string, filter: "all" | "deferred"): boolean {
  return filter === "all" || isPlanDate(date);
}
