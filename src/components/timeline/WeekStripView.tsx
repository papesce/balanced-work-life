"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { addDays, getToday, isPast, isPlanDate } from "@/lib/dateUtils";
import { DayTaskList } from "./DayTaskList";
import { QuickAddInput } from "./QuickAddInput";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { formatTimelineDate, getTimelineKicker } from "./timelineUtils";
import { TaskChip } from "./TaskChip";

const MAX_WEEK_CHIPS = 5;

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

function WeekDayCell({
  date,
  anchor,
  today,
  tomorrow,
  occurrences,
  onOpen,
  justDraggedRef,
  getTagsForIdea,
}: {
  date: string;
  anchor: string;
  today: string;
  tomorrow: string;
  occurrences: DayOccurrence[];
  onOpen: () => void;
  justDraggedRef: React.MutableRefObject<number>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `week-day-${date}`, data: { date } });
  const current = useMemo(() => occurrences.filter((o) => !o.isHistorical), [occurrences]);
  const dayTasks = useMemo(() => current.map((o) => o.task), [current]);
  const visible = current.slice(0, MAX_WEEK_CHIPS);
  const overflow = current.length - visible.length;
  const isAnchor = date === anchor;
  const isToday = date === today;
  const unresolvedCount = current.filter(
    (o) => o.task.status !== "completed" && o.task.status !== "cancelled" && isPast(date),
  ).length;

  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={`flex min-h-[148px] cursor-pointer flex-col rounded-[20px] p-2 transition-colors ${
        isOver
          ? "border border-violet-400 bg-violet-50 ring-2 ring-violet-500/40 dark:border-violet-500 dark:bg-violet-950/20"
          : isAnchor
            ? "glass-card-anchor"
            : isToday
              ? "glass-card-today"
              : "glass-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-col gap-0.5 px-1 pt-1 pb-1.5">
        <span
          className={`text-[9px] font-semibold tracking-[0.12em] uppercase ${
            isAnchor ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {getTimelineKicker(date, today, tomorrow)}
        </span>
        <span className="flex items-center gap-1">
          <span className="truncate text-xs leading-tight font-bold text-gray-900 dark:text-gray-100">
            {formatTimelineDate(date)}
          </span>
          {isToday && (
            <span className="flex-shrink-0 rounded-full bg-emerald-100/80 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              Today
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <MiniBalanceBar tasks={dayTasks} getTagsForIdea={getTagsForIdea} date={date} />
          {current.length > 0 && (
            <span className="flex-shrink-0 rounded-full bg-black/[0.05] px-1 text-[9px] font-bold text-gray-500 tabular-nums dark:bg-white/[0.08] dark:text-gray-400">
              {current.length}
            </span>
          )}
          {unresolvedCount > 0 && (
            <span className="flex-shrink-0 rounded-full bg-red-100/80 px-1 py-px text-[9px] font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {unresolvedCount}
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 space-y-px" onClick={(e) => e.stopPropagation()}>
        {current.length === 0 ? (
          <p className="px-1 py-1 text-[10px] text-gray-400 italic dark:text-gray-500">No tasks</p>
        ) : (
          <>
            {visible.map((o) => (
              <TaskChip
                key={o.task.id}
                task={o.task}
                date={date}
                idPrefix="week"
                onOpen={onOpen}
                justDraggedRef={justDraggedRef}
              />
            ))}
            {overflow > 0 && (
              <button
                onClick={onOpen}
                className="w-full truncate rounded-md px-1 py-px text-left text-[9px] font-bold text-violet-500 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
              >
                +{overflow} more
              </button>
            )}
          </>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="mt-1 w-full rounded-lg px-1 py-1 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
        title={`Add task for ${formatTimelineDate(date)}`}
      >
        +
      </button>
    </div>
  );
}

export function WeekStripView(props: WeekStripViewProps) {
  const { weekDates, anchor, today, tomorrow, occurrencesByDate, onAnchorChange, onReschedule } =
    props;
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const justDraggedRef = useRef(0);

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
        (o) => o.task.status === "completed" || o.task.status === "cancelled",
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
    justDraggedRef.current = Date.now();
    void onReschedule(taskId, { type: "move", newDate: toDate });
  };

  const openOccurrences = useMemo(
    () => (openDate ? (props.occurrencesByDate[openDate] ?? []) : []),
    [props.occurrencesByDate, openDate],
  );
  const openDayTasks = useMemo(
    () => openOccurrences.filter((o) => !o.isHistorical).map((o) => o.task),
    [openOccurrences],
  );

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      <div className="space-y-4">
        <div className="glass-card flex items-center justify-between rounded-[20px] px-4 py-2.5">
          <button
            onClick={() => onAnchorChange(addDays(anchor, -7))}
            aria-label="Previous week"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
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
          </div>
          <button
            onClick={() => onAnchorChange(addDays(anchor, 7))}
            aria-label="Next week"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {weekDates.map((date) => (
            <WeekDayCell
              key={date}
              date={date}
              anchor={anchor}
              today={today}
              tomorrow={tomorrow}
              occurrences={occurrencesByDate[date] ?? []}
              onOpen={() => setOpenDate(date)}
              justDraggedRef={justDraggedRef}
              getTagsForIdea={props.getTagsForIdea}
            />
          ))}
        </div>
        {activeTaskId && (
          <p className="text-center text-[10px] font-semibold text-violet-500">
            Drop on a day to move the task there
          </p>
        )}
      </div>

      {openDate &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
              onClick={() => setOpenDate(null)}
              aria-hidden
            />
            <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:mx-4 sm:max-w-lg sm:rounded-2xl dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatTimelineDate(openDate)}
                  </span>
                  <MiniBalanceBar
                    tasks={openDayTasks}
                    getTagsForIdea={props.getTagsForIdea}
                    date={openDate}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setOpenDate(null)}
                    aria-label="Close day"
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const d = openDate;
                      setOpenDate(null);
                      props.onOpenDay?.(d);
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                  >
                    Open day →
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {openOccurrences.length === 0 ? (
                  <p className="py-2 text-xs text-gray-400 italic dark:text-gray-500">
                    No tasks planned
                  </p>
                ) : (
                  <DayTaskList
                    occurrences={openOccurrences}
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
              {props.showQuickAdd(openDate) && (
                <div className="border-t border-black/5 px-4 py-2 dark:border-white/5">
                  <QuickAddInput
                    placeholder={`+ Add task for ${formatTimelineDate(openDate)}...`}
                    area={props.quickAddArea}
                    onAreaChange={props.onQuickAddAreaChange}
                    onAdd={(text) => props.onQuickAdd(text, openDate)}
                    suggestFrom={props.suggestFrom}
                  />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </DndContext>
  );
}

export function isQuickAddVisible(date: string, filter: "all" | "deferred"): boolean {
  return filter === "all" || isPlanDate(date);
}
