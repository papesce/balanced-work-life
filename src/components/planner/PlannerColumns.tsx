"use client";

import { Eye, EyeOff, Sparkles } from "lucide-react";
import { BalanceRing } from "@/components/BalanceRing";
import { AreaFilters } from "@/components/planner/AreaFilters";
import { AreaTaskGroup } from "@/components/planner/AreaTaskGroup";
import { DayslotTimeline } from "@/components/planner/DayslotTimeline";
import { DeferredOnDateSection } from "@/components/planner/DeferredOnDateSection";
import { QuickNoteChip } from "@/components/quicknote/QuickNoteChip";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";
import type { DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import type { UndoAction } from "@/lib/tasks/undo";
import type { Idea, IdeaLink, LifeArea, LinkType, Tag } from "@/lib/types";

export type PlannerMobileTab = "tasks" | "schedule" | "balance";

export function PlannerLeftColumn({
  balanceRingCounts,
  areaTaskCounts,
  selectedArea,
  onSelectArea,
  targets,
  activeMobileTab,
}: {
  balanceRingCounts: Record<LifeArea, number>;
  areaTaskCounts: Record<LifeArea, { pending: number; scheduled: number; done: number }>;
  selectedArea: LifeArea | null;
  onSelectArea: (area: LifeArea | null) => void;
  targets: Record<LifeArea, number>;
  activeMobileTab: PlannerMobileTab;
}) {
  return (
    <div
      className={`w-full flex-shrink-0 space-y-4 md:w-[260px] ${activeMobileTab === "balance" ? "block" : "hidden md:block"} md:sticky md:top-[53px] md:self-start`}
    >
      <BalanceRing
        counts={balanceRingCounts}
        modeLabel="Work-Life Balance Ring"
        statLabel="Total Minutes"
        statSub="scheduled today"
      />
      <AreaFilters
        areaTaskCounts={areaTaskCounts}
        selectedArea={selectedArea}
        onSelectArea={(area) => onSelectArea(selectedArea === area ? null : area)}
        targets={targets}
      />
    </div>
  );
}

interface PlannerAgendaColumnProps {
  selectedArea: LifeArea | null;
  pendingCount: number;
  scheduledCount: number;
  completedCount: number;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
  canSmartSort: boolean;
  onSmartSort: () => void;
  deferredOccurrences: DayOccurrence[];
  today: string;
  getTagsForIdea: (ideaId: string) => Tag[];
  pendingByArea: Record<LifeArea, Idea[]>;
  doneByArea: Record<LifeArea, Idea[]>;
  dayIsEmpty: boolean;
  activeMobileTab: PlannerMobileTab;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onDelete: (id: string) => void;
  onAddTask: (text: string, area: LifeArea) => Promise<void>;
  onMoveTaskBetweenAreas: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  allTags: Tag[];
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onUndoAction: (action: UndoAction) => void;
  onAttach: (taskId: string, parentId: string) => Promise<void>;
  allIdeas: Idea[];
  links: IdeaLink[];
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
}

export function PlannerAgendaColumn({
  selectedArea,
  pendingCount,
  scheduledCount,
  completedCount,
  hideCompleted,
  onToggleHideCompleted,
  canSmartSort,
  onSmartSort,
  deferredOccurrences,
  today,
  getTagsForIdea,
  pendingByArea,
  doneByArea,
  dayIsEmpty,
  activeMobileTab,
  ...groupProps
}: PlannerAgendaColumnProps) {
  const visibleAreas = selectedArea ? [selectedArea] : AREA_ORDER;
  return (
    <div
      className={`min-w-0 flex-1 space-y-4 ${activeMobileTab === "tasks" ? "block" : "hidden md:block"}`}
    >
      <div className="glass-card flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-4 dark:border-white/5">
        <div className="flex flex-col">
          <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200">
            {selectedArea ? `${AREA_LABELS[selectedArea]} Focus` : "Today's Agenda"}
          </h2>
          <p className="mt-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {pendingCount + scheduledCount} pending tasks · {completedCount} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickNoteChip />
          <button
            onClick={onToggleHideCompleted}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-all hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {hideCompleted ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>{hideCompleted ? "Show Done" : "Hide Done"}</span>
          </button>
          {canSmartSort && (
            <button
              onClick={onSmartSort}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-600 transition-all hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
              title="Prioritize tasks by priority score"
            >
              <Sparkles size={12} />
              <span>Smart Sort</span>
            </button>
          )}
        </div>
      </div>

      {deferredOccurrences.length > 0 && (
        <DeferredOnDateSection
          occurrences={deferredOccurrences}
          today={today}
          getTagsForIdea={getTagsForIdea}
        />
      )}

      <div className="space-y-4">
        {visibleAreas.map((area) => {
          const pending = pendingByArea[area];
          const done = doneByArea[area];
          if (pending.length === 0 && done.length === 0 && selectedArea !== area && !dayIsEmpty)
            return null;
          return (
            <AreaTaskGroup
              key={area}
              area={area}
              pendingTasks={pending}
              doneTasks={done}
              getTagsForIdea={getTagsForIdea}
              {...groupProps}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PlannerScheduleColumn({
  activeDate,
  allTasks,
  onUpdateTask,
  onCreateTask,
  getTagsForIdea,
  tags,
  selectedArea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onSelectEvent,
  activeMobileTab,
  rightColWidth,
}: {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (
    text: string,
    time: string,
    area?: LifeArea,
    tag?: Tag,
    productivitySignal?: string | null,
  ) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
  tags: Tag[];
  selectedArea: LifeArea | null;
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onSelectEvent: (eventId: string) => void;
  activeMobileTab: PlannerMobileTab;
  rightColWidth: number;
}) {
  return (
    <div
      style={{ "--right-col-width": `${rightColWidth}px` } as React.CSSProperties}
      className={`resizable-right-col flex w-full flex-shrink-0 flex-col gap-4 ${
        activeMobileTab === "schedule" ? "block" : "hidden lg:flex"
      }`}
    >
      <div className="min-h-[400px] flex-1">
        <DayslotTimeline
          activeDate={activeDate}
          allTasks={allTasks}
          onUpdateTask={onUpdateTask}
          onCreateTask={onCreateTask}
          getTagsForIdea={getTagsForIdea}
          tags={tags}
          selectedArea={selectedArea}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </div>
  );
}
