"use client";

import { useMemo, useRef, useState } from "react";
import { DndContext, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { addMonths, getToday } from "@/lib/dateUtils";
import { DayTaskList } from "./DayTaskList";
import { QuickAddInput } from "./QuickAddInput";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { DateChip } from "@/components/shared/DateChip";
import { formatTimelineDate, formatDayTitle, formatTaskCount } from "./timelineUtils";
import { TaskChip } from "./TaskChip";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

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
  showQuickAdd?: (date: string) => boolean;
}

function DayCell({
  date,
  selected,
  today,
  isCurrentMonth,
  occurrences,
  onSelect,
  justDraggedRef,
}: {
  date: string;
  selected: boolean;
  today: string;
  isCurrentMonth: boolean;
  occurrences: DayOccurrence[];
  onSelect: () => void;
  justDraggedRef: React.MutableRefObject<number>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `month-day-${date}`, data: { date } });
  const current = useMemo(() => occurrences.filter((o) => !o.isHistorical), [occurrences]);
  const visible = current.slice(0, MAX_CHIPS);
  const overflow = current.length - visible.length;
  const dayNum = Number(date.slice(8, 10));
  const isToday = date === today;
  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        if (Date.now() - justDraggedRef.current < 300) return;
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${formatTimelineDate(date)}: ${formatTaskCount(current.length)}. Select to view.`}
      className={`min-h-[88px] w-full cursor-pointer rounded-xl border p-1 text-left transition-colors sm:min-h-[104px] ${
        isOver
          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-500/40 dark:border-violet-500 dark:bg-violet-950/20"
          : selected
            ? "glass-card-anchor"
            : "glass-card hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      } ${isCurrentMonth ? "" : "opacity-45"}${isToday ? "day-cell-today" : ""}`}
    >
      <span className="flex items-center justify-between px-0.5">
        <DateChip dayNum={dayNum} isToday={isToday} isSelected={selected} />
        {current.length > 0 && (
          <span className="rounded-full bg-black/[0.05] px-1 text-[9px] font-bold text-gray-500 tabular-nums dark:bg-white/[0.08] dark:text-gray-400">
            {current.length}
          </span>
        )}
      </span>
      <span className="mt-0.5 block space-y-px" onClick={(e) => e.stopPropagation()}>
        {visible.map((o) => (
          <TaskChip
            key={o.task.id}
            task={o.task}
            date={date}
            idPrefix="month"
            onOpen={onSelect}
            justDraggedRef={justDraggedRef}
          />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="block w-full truncate rounded-md px-1 py-px text-left text-[9px] font-bold text-violet-500 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
          >
            +{overflow} more
          </button>
        )}
      </span>
    </div>
  );
}

export function MonthGridView(props: MonthGridViewProps) {
  const { gridDates, anchor, today, occurrencesByDate, onAnchorChange, onReschedule } = props;
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
    void onReschedule(taskId, { type: "reschedule", newDate: toDate });
    if (toDate !== anchor) onAnchorChange(toDate);
  };

  const selectedOccurrences = useMemo(
    () => props.occurrencesByDate[anchor] ?? [],
    [props.occurrencesByDate, anchor],
  );
  const selectedDayTasks = useMemo(
    () => selectedOccurrences.filter((o) => !o.isHistorical).map((o) => o.task),
    [selectedOccurrences],
  );
  const canQuickAdd = props.showQuickAdd ? props.showQuickAdd(anchor) : true;

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      <div className="space-y-4">
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
                selected={date === anchor}
                today={today}
                isCurrentMonth={date.slice(0, 7) === anchorMonth}
                occurrences={occurrencesByDate[date] ?? []}
                onSelect={() => {
                  if (date !== anchor) onAnchorChange(date);
                }}
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

        <div className="glass-card scroll-mt-24 rounded-[20px] px-5 pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-[22px] leading-tight font-bold text-gray-900 dark:text-gray-100">
                {formatDayTitle(anchor, "detail").full}
              </span>
              <MiniBalanceBar
                tasks={selectedDayTasks}
                getTagsForIdea={props.getTagsForIdea}
                date={anchor}
              />
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
              <button
                onClick={() => props.onOpenDay(anchor)}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
              >
                Open day →
              </button>
            </div>
          </div>
          <div className="pb-2">
            {selectedOccurrences.length === 0 ? (
              <p className="py-2 text-xs text-gray-400 italic dark:text-gray-500">
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
                rescheduleDragPrefix="month"
              />
            )}
          </div>
          {canQuickAdd && (
            <div className="pt-1">
              <QuickAddInput
                placeholder={`+ Add task for ${formatTimelineDate(anchor)}...`}
                area={props.quickAddArea}
                onAreaChange={props.onQuickAddAreaChange}
                onAdd={(text) => props.onQuickAdd(text, anchor)}
              />
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}
