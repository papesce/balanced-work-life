"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Layers, Clock, BarChart3 } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useClassifications } from "@/hooks/useClassifications";
import { priorityRank } from "@/components/shared/PriorityChip";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { LifeArea, getAreasForIdea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";
import { DateNav } from "@/components/planner/DateNav";
import { UndoBar } from "@/components/shared/UndoBar";
import { useUndoAction } from "@/lib/tasks/undo";
import { PlannerDndProvider } from "@/components/planner/PlannerDnd";
import {
  PlannerAgendaColumn,
  PlannerLeftColumn,
  PlannerScheduleColumn,
} from "@/components/planner/PlannerColumns";
import { loadAreaTargets } from "@/lib/storage";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { usePlannerActions } from "@/hooks/usePlannerActions";
import { usePlannerDay } from "@/hooks/usePlannerDay";
import { useResizableColumn } from "@/hooks/useResizableColumn";

export default function DailyPlannerPage() {
  return (
    <Suspense>
      <DailyPlannerInner />
    </Suspense>
  );
}

function DailyPlannerInner() {
  const {
    ideas,
    loading,
    createIdea,
    updateIdea,
    deleteIdea,
    markDone,
    markUndone,
    reorderTasks,
    smartSortTasks,
    restoreIdeas,
  } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const linksHook = useIdeaLinks();
  const { getOptionForIdea } = useClassifications();
  const priorityRankOf = useCallback(
    (ideaId: string) =>
      priorityRank(
        (getOptionForIdea(ideaId, "priority")?.value ?? null) as "high" | "medium" | "low" | null,
      ),
    [getOptionForIdea],
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeDate, setActiveDate] = useState<string>(
    () => searchParams.get("date") ?? getToday(),
  );
  const highlightId = searchParams.get("highlight");

  const urlDate = searchParams.get("date");
  const [prevUrlDate, setPrevUrlDate] = useState(urlDate);
  if (urlDate !== prevUrlDate) {
    setPrevUrlDate(urlDate);
    if (urlDate) setActiveDate(urlDate);
  }

  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(null);
  const hideCompleted = useUiPrefsStore((s) => s.plannerHideCompleted);
  const setPrefs = useUiPrefsStore((s) => s.set);

  useEffect(() => {
    if (!highlightId || loading) return;
    // Guarantee the highlight target is visible: lift filters that could hide it.
    const target = ideas.find((i) => i.id === highlightId);
    if (target?.status === "completed" && hideCompleted) {
      setPrefs({ plannerHideCompleted: false });
    }
    if (target && selectedArea) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(target.id));
      const effective = areas.length === 0 ? (["life"] as LifeArea[]) : areas;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link clears area filter
      if (!effective.includes(selectedArea)) setSelectedArea(null);
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(`task-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        const cleanup = () => el.classList.remove("highlight-pulse");
        el.addEventListener("animationend", cleanup, { once: true });
        setTimeout(cleanup, 2500);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      router.replace(`/?${params.toString()}`, { scroll: false });
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlight deep-link runs once per highlightId
  }, [highlightId, loading, router, searchParams]);

  const [activeMobileTab, setActiveMobileTab] = useState<"tasks" | "schedule" | "balance">("tasks");
  const [targets] = useState<Record<LifeArea, number>>(() => loadAreaTargets());
  const [showDateInput, setShowDateInput] = useState(false);
  const { rightColWidth, handleResizeStart } = useResizableColumn();

  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

  const today = getToday();

  const {
    pendingOnDate,
    scheduledOnDate,
    visibleDoneOnDate,
    deferredOnDate,
    allTasksForTimeline,
    areaTaskCounts,
    balanceRingCounts,
    dayIsEmpty,
    pendingByArea,
    doneByArea,
  } = usePlannerDay({
    ideas,
    activeDate,
    today,
    hideCompleted,
    getTagsForIdea: taskTagsHook.getTagsForIdea,
  });

  const {
    handleAddToArea,
    handleMoveTaskBetweenAreas,
    handleAttach,
    handleDndMoveBetweenAreas,
    handleScheduleFromDrop,
    handleSortInArea,
    handleCreateScheduledTask,
    handleReschedule,
    handleDeleteTask,
  } = usePlannerActions({
    ideas,
    ideasApi: { createIdea, updateIdea, deleteIdea, restoreIdeas, reorderTasks },
    activeDate,
    tagsHook,
    taskTagsHook,
    registerUndo,
    pendingByArea,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading planner...</div>
      </div>
    );
  }

  return (
    <AppShell
      title="Daily Planner"
      fullWidth
      headerActions={
        <>
          <DateNav
            activeDate={activeDate}
            today={today}
            showDateInput={showDateInput}
            onShowDateInput={setShowDateInput}
            onChangeDate={setActiveDate}
          />
        </>
      }
    >
      {/* Mobile Tab Control */}
      <div className="sticky top-[52px] z-10 mb-4 flex gap-1 rounded-2xl border border-black/5 bg-white/60 p-1.5 shadow-sm backdrop-blur-lg md:hidden dark:border-white/5 dark:bg-gray-900/60">
        {[
          { id: "tasks", label: "Tasks", icon: Layers },
          { id: "schedule", label: "Schedule", icon: Clock },
          { id: "balance", label: "Balance", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMobileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as typeof activeMobileTab)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-all duration-200 ${
                isActive
                  ? "bg-violet-600 text-white shadow-md dark:bg-violet-500 dark:text-white"
                  : "text-gray-500 hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

      <PlannerDndProvider
        pendingByArea={pendingByArea}
        doneByArea={doneByArea}
        onSortInArea={handleSortInArea}
        onMoveBetweenAreas={handleDndMoveBetweenAreas}
        onSchedule={handleScheduleFromDrop}
      >
        <div className="flex flex-col gap-5 md:flex-row">
          <PlannerLeftColumn
            balanceRingCounts={balanceRingCounts}
            areaTaskCounts={areaTaskCounts}
            selectedArea={selectedArea}
            onSelectArea={setSelectedArea}
            targets={targets}
            activeMobileTab={activeMobileTab}
          />
          <PlannerAgendaColumn
            selectedArea={selectedArea}
            pendingCount={pendingOnDate.length}
            scheduledCount={scheduledOnDate.length}
            completedCount={visibleDoneOnDate.length}
            hideCompleted={hideCompleted}
            onToggleHideCompleted={() => setPrefs({ plannerHideCompleted: !hideCompleted })}
            canSmartSort={pendingOnDate.length > 0}
            onSmartSort={() => smartSortTasks(pendingOnDate, priorityRankOf)}
            deferredOccurrences={deferredOnDate}
            today={today}
            getTagsForIdea={taskTagsHook.getTagsForIdea}
            pendingByArea={pendingByArea}
            doneByArea={doneByArea}
            dayIsEmpty={dayIsEmpty}
            activeMobileTab={activeMobileTab}
            onDone={markDone}
            onUndone={markUndone}
            onUpdate={updateIdea}
            onReschedule={handleReschedule}
            onDelete={handleDeleteTask}
            onAddTask={handleAddToArea}
            onMoveTaskBetweenAreas={handleMoveTaskBetweenAreas}
            allTags={tagsHook.tags}
            onCreateTag={tagsHook.createTag}
            onAddTag={async (ideaId, tag) => {
              await taskTagsHook.addTagToTask(ideaId, tag);
            }}
            onRemoveTag={async (ideaId, tagId) => {
              await taskTagsHook.removeTagFromTask(ideaId, tagId);
            }}
            onUndoAction={registerUndo}
            onAttach={handleAttach}
            allIdeas={ideas}
            links={linksHook.links}
            onCreateLink={linksHook.createLink}
            onDeleteLink={linksHook.deleteLink}
          />
          {/* RESIZE HANDLE */}
          <div
            onMouseDown={handleResizeStart}
            className="group hidden w-3 flex-shrink-0 cursor-col-resize items-center justify-center md:flex"
          >
            <div className="flex flex-col gap-[3px] opacity-40 transition-opacity group-hover:opacity-100">
              <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-violet-400 dark:bg-gray-500" />
              <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-violet-400 dark:bg-gray-500" />
              <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-violet-400 dark:bg-gray-500" />
            </div>
          </div>
          <PlannerScheduleColumn
            activeDate={activeDate}
            allTasks={allTasksForTimeline}
            onUpdateTask={updateIdea}
            onCreateTask={handleCreateScheduledTask}
            getTagsForIdea={taskTagsHook.getTagsForIdea}
            tags={tagsHook.tags}
            selectedArea={selectedArea}
            onAddTag={async (ideaId, tag) => {
              await taskTagsHook.addTagToTask(ideaId, tag);
            }}
            onRemoveTag={async (ideaId, tagId) => {
              await taskTagsHook.removeTagFromTask(ideaId, tagId);
            }}
            onCreateTag={async (name, area) => {
              const tag = await tagsHook.createTag(name, area);
              return tag ?? null;
            }}
            onSelectEvent={(eventId) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("highlight", eventId);
              router.replace(`/?${params.toString()}`, { scroll: false });
            }}
            activeMobileTab={activeMobileTab}
            rightColWidth={rightColWidth}
          />
        </div>
      </PlannerDndProvider>
    </AppShell>
  );
}
