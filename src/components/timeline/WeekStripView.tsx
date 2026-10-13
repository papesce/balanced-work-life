"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { isPlanDate } from "@/lib/dateUtils";
import { useWeekModel } from "@/hooks/useWeekModel";
import { useClassifications } from "@/hooks/useClassifications";
import { WeekDayCell } from "@/components/timeline/week/WeekDayCell";
import { WeekDetailPanel } from "@/components/timeline/week/WeekDetailPanel";
import { WeekHeader } from "@/components/timeline/week/WeekHeader";

export type WeekCardPreview = "top" | "times" | "status" | "priority";

export const WEEK_CARD_PREVIEWS: readonly { id: WeekCardPreview; label: string }[] = [
  { id: "top", label: "Top 3" },
  { id: "times", label: "Times" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
];

export interface WeekStripViewProps {
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const { getOptionForIdea } = useClassifications();
  const {
    selectedDate,
    priorityOf,
    weekLabel,
    containsToday,
    weekTotals,
    selectedOccurrences,
    selectedDayTasks,
    detailRef,
  } = useWeekModel({
    weekDates,
    anchor,
    today,
    occurrencesByDate,
    getOptionForIdea,
  });

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

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      <div className="space-y-4">
        <WeekHeader
          anchor={anchor}
          weekLabel={weekLabel}
          containsToday={containsToday}
          weekTotals={weekTotals}
          cardPreview={cardPreview}
          onAnchorChange={onAnchorChange}
          onCardPreviewChange={onCardPreviewChange}
        />
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

        <WeekDetailPanel
          selectedDate={selectedDate}
          selectedOccurrences={selectedOccurrences}
          selectedDayTasks={selectedDayTasks}
          detailRef={detailRef}
          viewProps={props}
        />
      </div>
    </DndContext>
  );
}

export function isQuickAddVisible(date: string, filter: "all" | "deferred"): boolean {
  return filter === "all" || isPlanDate(date);
}
