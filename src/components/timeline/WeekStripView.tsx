"use client";

import { useEffect, useMemo, useRef } from "react";
import { DndContext, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { addDays, getToday, isPast, isPlanDate } from "@/lib/dateUtils";
import { DayTaskList } from "./DayTaskList";
import { QuickAddInput } from "./QuickAddInput";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { DateChip } from "@/components/shared/DateChip";
import {
  formatTimelineDate,
  formatDayTitle,
  formatTaskCount,
  getTimelineKicker,
} from "./timelineUtils";
import { TASK_STATUS_DOT } from "./TaskChip";
import { useClassifications } from "@/hooks/useClassifications";
import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";

export type WeekCardPreview = "top" | "times" | "status" | "priority";

export const WEEK_CARD_PREVIEWS: readonly { id: WeekCardPreview; label: string }[] = [
  { id: "top", label: "Top 3" },
  { id: "times", label: "Times" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
];

interface WeekStripViewProps {
  weekDates: string[];
  anchor: string;
  today: string;
  tomorrow: string;
  occurrencesByDate: Record<string, DayOccurrence[]>;
  showQuickAdd: (date: string) => boolean;
  onAnchorChange: (date: string) => void;
  /** Jump to the linear agenda for a date. */
  onOpenDay?: (date: string) => void;
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onSmartSort?: (tasks: Idea[]) => void;
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
  cardPreview: WeekCardPreview;
  onCardPreviewChange: (preview: WeekCardPreview) => void;
}

function WeekDayCell({
  date,
  selected,
  today,
  tomorrow,
  occurrences,
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
  onSelect: () => void;
  getTagsForIdea: (ideaId: string) => import("@/lib/types").Tag[];
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
  const isToday = date === today;
  const kicker = getTimelineKicker(date, today, tomorrow);
  const unresolvedCount = current.filter(
    (o) =>
      o.task.status !== "completed" &&
      o.task.status !== "cancelled" &&
      o.task.status !== "missed" &&
      isPast(date),
  ).length;

  const previewContent = useMemo(() => {
    if (current.length === 0) {
      return <p className="px-0.5 py-0.5 text-[10px] text-gray-400 italic">No tasks</p>;
    }
    if (preview === "top") {
      const sorted = [...current].sort((a, b) => {
        const at = a.task.scheduled_time ?? "99";
        const bt = b.task.scheduled_time ?? "99";
        if (at !== bt) return at < bt ? -1 : 1;
        const rankDiff = priorityRank(priorityOf(a.task.id)) - priorityRank(priorityOf(b.task.id));
        if (rankDiff !== 0) return rankDiff;
        const ad =
          a.task.status === "completed" ||
          a.task.status === "cancelled" ||
          a.task.status === "missed"
            ? 1
            : 0;
        const bd =
          b.task.status === "completed" ||
          b.task.status === "cancelled" ||
          b.task.status === "missed"
            ? 1
            : 0;
        return ad - bd;
      });
      const visible = sorted.slice(0, 3);
      const overflow = sorted.length - visible.length;
      return (
        <span className="block min-h-[44px] space-y-px">
          {visible.map((o) => {
            const tDone =
              o.task.status === "completed" ||
              o.task.status === "cancelled" ||
              o.task.status === "missed";
            return (
              <span
                key={o.task.id}
                title={
                  o.task.scheduled_time
                    ? `${o.task.text} · ${o.task.scheduled_time.slice(0, 5)}`
                    : o.task.text
                }
                className={`flex w-full items-center gap-1 truncate rounded px-0.5 py-px text-left text-[10px] font-medium ${tDone ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-200"}`}
              >
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${TASK_STATUS_DOT[o.task.status] ?? TASK_STATUS_DOT.planned}`}
                />
                {o.task.scheduled_time && (
                  <span className="flex-shrink-0 font-semibold text-violet-600 tabular-nums dark:text-violet-400">
                    {o.task.scheduled_time.slice(0, 5)}
                  </span>
                )}
                <span className="truncate">{o.task.text || "Untitled"}</span>
                {priorityOf(o.task.id) === "high" && (
                  <span className="flex-shrink-0 text-[9px] text-amber-400">★</span>
                )}
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="block px-0.5 text-[9px] font-bold text-violet-500">
              +{overflow} more
            </span>
          )}
        </span>
      );
    }
    if (preview === "times") {
      const timed = current
        .filter((o) => o.task.scheduled_time)
        .sort((a, b) => (a.task.scheduled_time! < b.task.scheduled_time! ? -1 : 1));
      const untimed = current.length - timed.length;
      if (timed.length === 0) {
        return (
          <span className="block px-0.5 py-0.5 text-[10px] text-gray-400">
            Untimed · {current.length}
          </span>
        );
      }
      const first = timed[0].task.scheduled_time!.slice(0, 5);
      const last = timed[timed.length - 1].task.scheduled_time!.slice(0, 5);
      return (
        <span className="block space-y-0.5 px-0.5">
          <span className="block text-[11px] font-bold text-gray-700 tabular-nums dark:text-gray-200">
            {first}
            {first !== last ? `–${last}` : ""}
          </span>
          <span className="block text-[10px] text-gray-500">
            {timed.length} timed{untimed > 0 ? ` · ${untimed} untimed` : ""}
          </span>
          <span className="block truncate text-[10px] text-gray-400" title={timed[0].task.text}>
            Next: {timed[0].task.text || "Untitled"}
          </span>
        </span>
      );
    }
    if (preview === "status") {
      const groups: { key: string; label: string; count: number }[] = [
        {
          key: "completed",
          label: "Done",
          count: current.filter(
            (o) =>
              o.task.status === "completed" ||
              o.task.status === "cancelled" ||
              o.task.status === "missed",
          ).length,
        },
        {
          key: "in_progress",
          label: "In Progress",
          count: current.filter(
            (o) =>
              o.task.status === "in_progress" ||
              o.task.status === "scheduled" ||
              o.task.status === "paused",
          ).length,
        },
        {
          key: "planned",
          label: "Planned",
          count: current.filter((o) => o.task.status === "planned" || o.task.status === "deferred")
            .length,
        },
      ];
      return (
        <span className="block min-h-[44px] space-y-0.5 px-0.5">
          {groups.map((g) => (
            <span
              key={g.key}
              className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 dark:text-gray-300"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${TASK_STATUS_DOT[g.key] ?? TASK_STATUS_DOT.planned}`}
              />
              <span className="tabular-nums">{g.count}</span> {g.label}
            </span>
          ))}
        </span>
      );
    }
    // priority
    const isOpen = (o: (typeof current)[number]) =>
      o.task.status !== "completed" && o.task.status !== "cancelled" && o.task.status !== "missed";
    const ranked = current
      .filter((o) => isOpen(o) && priorityOf(o.task.id) !== null)
      .sort((a, b) => priorityRank(priorityOf(a.task.id)) - priorityRank(priorityOf(b.task.id)));
    const open = current.filter(isOpen);
    const topRanked = ranked.slice(0, 2);
    return (
      <span className="block min-h-[44px] space-y-0.5 px-0.5">
        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-700 dark:text-gray-200">
          <span className="text-amber-400">★</span>
          <span className="tabular-nums">{ranked.length}</span> priority
          {unresolvedCount > 0 && (
            <span className="rounded-full bg-red-100/80 px-1 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {unresolvedCount} overdue
            </span>
          )}
        </span>
        {topRanked.map((o) => (
          <span
            key={o.task.id}
            className="block truncate text-[10px] text-gray-500"
            title={o.task.text}
          >
            {o.task.scheduled_time ? `${o.task.scheduled_time.slice(0, 5)} ` : ""}
            {o.task.text || "Untitled"}
          </span>
        ))}
        {topRanked.length === 0 && (
          <span className="block text-[10px] text-gray-400">
            {open.length > 0 ? `${open.length} open, none ranked` : "All clear"}
          </span>
        )}
      </span>
    );
  }, [current, preview, unresolvedCount, priorityOf]);

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
      }`}
    >
      <span className="flex items-center gap-1.5">
        <DateChip dayNum={Number(date.slice(8, 10))} isToday={isToday} isSelected={selected} />
        <span
          className={`truncate text-xs font-bold text-gray-900 dark:text-gray-100 ${selected && !isToday ? "text-violet-700 dark:text-violet-300" : ""} ${isToday ? "underline decoration-violet-500 decoration-2 underline-offset-4" : ""}`}
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
      {previewContent}
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

export function WeekStripView(props: WeekStripViewProps) {
  const {
    weekDates,
    anchor,
    today,
    tomorrow,
    occurrencesByDate,
    onAnchorChange,
    onReschedule,
    cardPreview,
    onCardPreviewChange,
  } = props;
  // Anchor (?date=) doubles as the selected day: week is derived from it upstream,
  // so selection survives refresh / back-forward without an extra param.
  const selectedDate = weekDates.includes(anchor)
    ? anchor
    : weekDates.includes(today)
      ? today
      : weekDates[0];
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const { getOptionForIdea } = useClassifications();
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

  const handleDragStart = (e: DragStartEvent) => {
    const taskId = (e.active.data.current as { taskId?: string } | undefined)?.taskId;
    setActiveTaskId(taskId ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTaskId(null);
    const toDate = (e.over?.data.current as { date?: string } | undefined)?.date;
    const { taskId, fromDate } =
      (e.active.data.current as { taskId?: string; fromDate?: string }) ?? {};
    if (!taskId || !toDate || toDate === fromDate) return;
    void onReschedule(taskId, { type: "reschedule", newDate: toDate });
    // Keep the moved task visible: follow it to the target day.
    if (toDate !== anchor) onAnchorChange(toDate);
  };

  const selectedOccurrences = useMemo(
    () => props.occurrencesByDate[selectedDate] ?? [],
    [props.occurrencesByDate, selectedDate],
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

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      <div className="space-y-4">
        <div className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-[20px] px-4 py-2.5">
          <button
            onClick={() => onAnchorChange(addDays(anchor, -7))}
            aria-label="Previous week"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <button
              onClick={() => onAnchorChange(getToday())}
              title="Jump to this week"
              className="text-sm font-bold text-gray-900 hover:text-violet-600 dark:text-gray-100 dark:hover:text-violet-400"
            >
              {weekLabel}
            </button>
            {containsToday && (
              <span className="rounded-full bg-emerald-100/80 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                This week
              </span>
            )}
            {weekTotals.total > 0 && (
              <span className="text-[11px] font-semibold text-gray-400 tabular-nums dark:text-gray-500">
                {weekTotals.done}/{weekTotals.total} done
              </span>
            )}
            <span
              className="flex items-center gap-0.5 rounded-lg border border-black/5 bg-white/70 p-0.5 dark:border-white/5 dark:bg-gray-900/60"
              role="group"
              aria-label="Day card preview"
            >
              {WEEK_CARD_PREVIEWS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onCardPreviewChange(p.id)}
                  aria-pressed={cardPreview === p.id}
                  title={`Show ${p.label.toLowerCase()} on each day card`}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
                    cardPreview === p.id
                      ? "bg-white font-bold text-violet-600 shadow-sm dark:bg-gray-800 dark:text-violet-400"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </span>
          </div>
          <button
            onClick={() => onAnchorChange(addDays(anchor, 7))}
            aria-label="Next week"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Days of the week"
          className="flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-7 md:overflow-visible md:pb-0"
        >
          {weekDates.map((date) => (
            <div
              key={date}
              role="tab"
              aria-selected={date === selectedDate}
              className="min-w-[136px] flex-1 snap-start md:min-w-0"
            >
              <WeekDayCell
                date={date}
                selected={date === selectedDate}
                today={today}
                tomorrow={tomorrow}
                occurrences={occurrencesByDate[date] ?? []}
                onSelect={() => {
                  if (date !== anchor) onAnchorChange(date);
                }}
                getTagsForIdea={props.getTagsForIdea}
                preview={cardPreview}
                priorityOf={priorityOf}
              />
            </div>
          ))}
        </div>
        {activeTaskId && (
          <p className="text-center text-[10px] font-semibold text-violet-500">
            Drop on a day to move the task there — drag the calendar icon on any row
          </p>
        )}

        <div ref={detailRef} className="glass-card scroll-mt-24 rounded-[20px] px-5 pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-[22px] leading-tight font-bold text-gray-900 dark:text-gray-100">
                {formatDayTitle(selectedDate, "detail").full}
              </span>
              <MiniBalanceBar
                tasks={selectedDayTasks}
                getTagsForIdea={props.getTagsForIdea}
                date={selectedDate}
              />
              {selectedDayTasks.length > 0 && (
                <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                  {
                    selectedDayTasks.filter(
                      (t) =>
                        t.status === "completed" ||
                        t.status === "cancelled" ||
                        t.status === "missed",
                    ).length
                  }
                  /{selectedDayTasks.length} done
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {selectedDayTasks.length > 0 && props.onSmartSort && (
                <button
                  onClick={() => props.onSmartSort?.(selectedDayTasks)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-all hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                  title="Sort tasks by priority score (effort × impact × urgency)"
                >
                  <Sparkles size={12} />
                  <span className="hidden sm:inline">Smart Sort</span>
                </button>
              )}
              {props.onOpenDay && (
                <button
                  onClick={() => props.onOpenDay?.(selectedDate)}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                >
                  Open day →
                </button>
              )}
            </div>
          </div>

          <div className="pb-2">
            {selectedOccurrences.length === 0 ? (
              <p className="py-1 text-xs text-gray-400 italic dark:text-gray-500">
                No tasks planned
              </p>
            ) : (
              <DayTaskList
                occurrences={selectedOccurrences}
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
                rescheduleDragPrefix="week"
              />
            )}
          </div>

          {props.showQuickAdd(selectedDate) && (
            <div className="pt-1">
              <QuickAddInput
                placeholder={`+ Add task for ${formatTimelineDate(selectedDate)}...`}
                area={props.quickAddArea}
                onAreaChange={props.onQuickAddAreaChange}
                onAdd={(text) => props.onQuickAdd(text, selectedDate)}
                suggestFrom={props.suggestFrom}
              />
            </div>
          )}
          {!props.showQuickAdd(selectedDate) && !isPlanDate(selectedDate) && (
            <p className="pt-1 text-[11px] text-gray-400 italic">
              Past date — drag the calendar icon on a row to reschedule it.
            </p>
          )}
        </div>
      </div>
    </DndContext>
  );
}

export function isQuickAddVisible(date: string, filter: "all" | "deferred"): boolean {
  return filter === "all" || isPlanDate(date);
}
