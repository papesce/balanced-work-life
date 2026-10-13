"use client";

import type { RefObject } from "react";
import { Sparkles } from "lucide-react";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { DayTaskList } from "@/components/timeline/DayTaskList";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import type { WeekStripViewProps } from "@/components/timeline/WeekStripView";
import { formatDayTitle, formatTimelineDate } from "@/components/timeline/timelineUtils";
import { isPlanDate } from "@/lib/dateUtils";
import type { DayOccurrence } from "@/lib/tasks/rescheduleTask";
import type { Idea } from "@/lib/types";

type ViewProps = Pick<
  WeekStripViewProps,
  | "today"
  | "onOpenDay"
  | "onReorder"
  | "onDone"
  | "onUndone"
  | "onUpdate"
  | "onReschedule"
  | "onMove"
  | "onSmartSort"
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
  | "showQuickAdd"
  | "quickAddArea"
  | "onQuickAddAreaChange"
  | "onQuickAdd"
  | "suggestFrom"
>;

export function WeekDetailPanel({
  selectedDate,
  selectedOccurrences,
  selectedDayTasks,
  detailRef,
  viewProps,
}: {
  selectedDate: string;
  selectedOccurrences: DayOccurrence[];
  selectedDayTasks: Idea[];
  detailRef: RefObject<HTMLDivElement | null>;
  viewProps: ViewProps;
}) {
  return (
    <div ref={detailRef} className="glass-card scroll-mt-24 rounded-[20px] px-5 pt-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[22px] leading-tight font-bold text-gray-900 dark:text-gray-100">
            {formatDayTitle(selectedDate, "detail").full}
          </span>
          <MiniBalanceBar
            tasks={selectedDayTasks}
            getTagsForIdea={viewProps.getTagsForIdea}
            date={selectedDate}
          />
          {selectedDayTasks.length > 0 && (
            <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
              {
                selectedDayTasks.filter(
                  (t) =>
                    t.status === "completed" || t.status === "cancelled" || t.status === "missed",
                ).length
              }
              /{selectedDayTasks.length} done
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedDayTasks.length > 0 && viewProps.onSmartSort && (
            <button
              onClick={() => viewProps.onSmartSort?.(selectedDayTasks)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-all hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
              title="Sort tasks by priority score (effort × impact × urgency)"
            >
              <Sparkles size={12} />
              <span className="hidden sm:inline">Smart Sort</span>
            </button>
          )}
          {viewProps.onOpenDay && (
            <button
              onClick={() => viewProps.onOpenDay?.(selectedDate)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-500 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/20"
            >
              Open day →
            </button>
          )}
        </div>
      </div>

      <div className="pb-2">
        {selectedOccurrences.length === 0 ? (
          <p className="py-1 text-xs text-gray-400 italic dark:text-gray-500">No tasks planned</p>
        ) : (
          <DayTaskList
            occurrences={selectedOccurrences}
            onReorder={viewProps.onReorder}
            onDone={viewProps.onDone}
            onUndone={viewProps.onUndone}
            onUpdate={viewProps.onUpdate}
            onReschedule={viewProps.onReschedule}
            onMove={viewProps.onMove}
            ideas={viewProps.ideas}
            links={viewProps.links}
            onCreateLink={viewProps.onCreateLink}
            onDeleteLink={viewProps.onDeleteLink}
            today={viewProps.today}
            onGoToDate={viewProps.onGoToDate}
            allTags={viewProps.allTags}
            getTagsForIdea={viewProps.getTagsForIdea}
            onAddTag={viewProps.onAddTag}
            onRemoveTag={viewProps.onRemoveTag}
            onCreateTag={viewProps.onCreateTag}
            rescheduleDragPrefix="week"
          />
        )}
      </div>

      {viewProps.showQuickAdd(selectedDate) && (
        <div className="pt-1">
          <QuickAddInput
            placeholder={`+ Add task for ${formatTimelineDate(selectedDate)}...`}
            area={viewProps.quickAddArea}
            onAreaChange={viewProps.onQuickAddAreaChange}
            onAdd={(text) => viewProps.onQuickAdd(text, selectedDate)}
            suggestFrom={viewProps.suggestFrom}
          />
        </div>
      )}
      {!viewProps.showQuickAdd(selectedDate) && !isPlanDate(selectedDate) && (
        <p className="pt-1 text-[11px] text-gray-400 italic">
          Past date — drag the calendar icon on a row to reschedule it.
        </p>
      )}
    </div>
  );
}
