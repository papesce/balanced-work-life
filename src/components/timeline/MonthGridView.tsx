"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { addMonths, getToday } from "@/lib/dateUtils";
import { DayTaskList } from "./DayTaskList";
import { QuickAddInput } from "./QuickAddInput";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { formatTimelineDate } from "./timelineUtils";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

const STATUS_DOT: Record<string, string> = {
  completed: "bg-violet-500",
  cancelled: "bg-red-400",
  in_progress: "bg-amber-500",
  paused: "bg-orange-400",
  scheduled: "bg-sky-500",
  planned: "bg-gray-300 dark:bg-gray-600",
  deferred: "bg-gray-300 dark:bg-gray-600",
  archived: "bg-gray-300 dark:bg-gray-600",
};

interface MonthGridViewProps {
  gridDates: string[];
  anchor: string;
  today: string;
  occurrencesByDate: Record<string, DayOccurrence[]>;
  onAnchorChange: (date: string) => void;
  /** Jump to the linear agenda for a date. */
  onOpenDay: (date: string) => void;
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
}

function TaskChip({
  task,
  date,
  onOpen,
  justDraggedRef,
}: {
  task: Idea;
  date: string;
  onOpen: () => void;
  justDraggedRef: React.MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `month-chip-${task.id}-${date}`,
    data: { taskId: task.id, fromDate: date },
  });
  const done = task.status === "completed" || task.status === "cancelled";
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (Date.now() - justDraggedRef.current < 300) return;
        onOpen();
      }}
      title={task.scheduled_time ? `${task.text} · ${task.scheduled_time.slice(0, 5)}` : task.text}
      className={`flex w-full cursor-grab items-center gap-1 truncate rounded-md px-1 py-px text-left text-[10px] font-medium transition-colors hover:bg-black/[0.06] active:cursor-grabbing dark:hover:bg-white/[0.08] ${
        done ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[task.status] ?? STATUS_DOT.planned}`}
      />
      {task.scheduled_time && (
        <span className="flex-shrink-0 font-semibold text-violet-600 tabular-nums dark:text-violet-400">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}
      <span className="truncate">{task.text || "Untitled"}</span>
    </button>
  );
}

function DayCell({
  date,
  anchor,
  today,
  isCurrentMonth,
  occurrences,
  onOpen,
  justDraggedRef,
}: {
  date: string;
  anchor: string;
  today: string;
  isCurrentMonth: boolean;
  occurrences: DayOccurrence[];
  onOpen: () => void;
  justDraggedRef: React.MutableRefObject<number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `month-day-${date}`, data: { date } });
  const current = useMemo(() => occurrences.filter((o) => !o.isHistorical), [occurrences]);
  const visible = current.slice(0, MAX_CHIPS);
  const overflow = current.length - visible.length;
  const dayNum = Number(date.slice(8, 10));
  const isAnchor = date === anchor;
  const isToday = date === today;
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={`min-h-[88px] cursor-pointer rounded-xl border p-1 transition-colors sm:min-h-[104px] ${
        isOver
          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-500/40 dark:border-violet-500 dark:bg-violet-950/20"
          : isAnchor
            ? "glass-card-anchor"
            : "glass-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      } ${isCurrentMonth ? "" : "opacity-45"}`}
    >
      <div className="flex items-center justify-between px-0.5">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            isToday
              ? "bg-violet-600 text-white"
              : isAnchor
                ? "text-violet-600 dark:text-violet-400"
                : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {dayNum}
        </span>
        {current.length > 0 && (
          <span className="rounded-full bg-black/[0.05] px-1 text-[9px] font-bold text-gray-500 tabular-nums dark:bg-white/[0.08] dark:text-gray-400">
            {current.length}
          </span>
        )}
      </div>
      <div className="mt-0.5 space-y-px" onClick={(e) => e.stopPropagation()}>
        {visible.map((o) => (
          <TaskChip
            key={o.task.id}
            task={o.task}
            date={date}
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
      </div>
    </div>
  );
}

export function MonthGridView(props: MonthGridViewProps) {
  const { gridDates, anchor, today, occurrencesByDate, onAnchorChange, onOpenDay, onReschedule } =
    props;
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const justDraggedRef = useRef(0);

  const monthLabel = useMemo(() => {
    const d = new Date(anchor + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [anchor]);
  const anchorMonth = anchor.slice(0, 7);

  const handleDragStart = (e: DragStartEvent) => {
    const taskId = (e.active.data.current as { taskId?: string } | undefined)?.taskId;
    setActiveTaskId(taskId ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTaskId(null);
    const toDate = (e.over?.data.current as { date?: string } | undefined)?.date;
    const { taskId, fromDate } =
      (e.active.data.current as {
        taskId?: string;
        fromDate?: string;
      }) ?? {};
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
      <div className="glass-card rounded-[20px] px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => onAnchorChange(addMonths(anchor, -1))}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onAnchorChange(getToday())}
            title="Jump to today"
            className="text-base font-bold text-gray-900 hover:text-violet-600 dark:text-gray-100 dark:hover:text-violet-400"
          >
            {monthLabel}
          </button>
          <button
            onClick={() => onAnchorChange(addMonths(anchor, 1))}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1.5 sm:gap-2">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {gridDates.map((date) => (
            <DayCell
              key={date}
              date={date}
              anchor={anchor}
              today={today}
              isCurrentMonth={date.slice(0, 7) === anchorMonth}
              occurrences={occurrencesByDate[date] ?? []}
              onOpen={() => setOpenDate(date)}
              justDraggedRef={justDraggedRef}
            />
          ))}
        </div>
        {activeTaskId && (
          <p className="mt-2 text-center text-[10px] font-semibold text-violet-500">
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
                <button
                  onClick={() => {
                    setOpenDate(null);
                    onOpenDay(openDate);
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                >
                  Open day →
                </button>
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
              <div className="border-t border-black/5 px-4 py-2 dark:border-white/5">
                <QuickAddInput
                  placeholder={`+ Add task for ${formatTimelineDate(openDate)}...`}
                  area={props.quickAddArea}
                  onAreaChange={props.onQuickAddAreaChange}
                  onAdd={(text) => props.onQuickAdd(text, openDate)}
                  suggestFrom={props.ideas}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </DndContext>
  );
}
