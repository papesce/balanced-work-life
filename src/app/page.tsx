"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Calendar, Layers, Clock, Inbox, BarChart3 } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { useDeferredTasks } from "@/hooks/useDeferredTasks";
import { AppShell } from "@/components/AppShell";
import { BalanceRing } from "@/components/BalanceRing";
import { Idea, LifeArea, getAreasForIdea } from "@/lib/types";
import { getToday, toLocalDateString } from "@/lib/dateUtils";
import { DateNav } from "@/components/planner/DateNav";
import { AreaFilters } from "@/components/planner/AreaFilters";
import { DayslotTimeline } from "@/components/planner/DayslotTimeline";
import { AreaTaskGroup } from "@/components/planner/AreaTaskGroup";
import { InboxDeferredPanel } from "@/components/shared/InboxDeferredPanel";
import { AREA_ORDER, AREA_LABELS, DEFAULT_TARGETS, LOCAL_STORAGE_TARGETS_KEY } from "@/components/planner/constants";
import { offsetDate } from "@/components/planner/plannerUtils";
import { computeReschedulePatch, computeCompletePatch, RescheduleAction } from "@/lib/tasks/rescheduleTask";

type UndoAction = {
  label: string;
  run: () => Promise<void>;
};

export default function DailyPlannerPage() {
  return (
    <Suspense>
      <DailyPlannerInner />
    </Suspense>
  );
}

function DailyPlannerInner() {
  const { ideas, loading, createIdea, updateIdea, deleteIdea, markDone, markUndone, reorderTasks, smartSortTasks, restoreIdeas } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const { overdueBuckets, deferredTasks } = useDeferredTasks();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeDate, setActiveDate] = useState<string>(() => searchParams.get("date") ?? getToday());
  const highlightId = searchParams.get("highlight");

  useEffect(() => {
    const d = searchParams.get("date");
    if (d) setActiveDate(d);
  }, [searchParams]);

  useEffect(() => {
    if (!highlightId || loading) return;
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
  }, [highlightId, loading, router, searchParams]);

  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"tasks" | "schedule" | "backlog" | "balance">("tasks");
  const [rightPanelTab, setRightPanelTab] = useState<"schedule" | "backlog">("schedule");
  const [targets, setTargets] = useState<Record<LifeArea, number>>(DEFAULT_TARGETS);
  const [showDateInput, setShowDateInput] = useState(false);
  const [rightColWidth, setRightColWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("planner-right-col-width");
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 320 && n <= 600) return n;
      }
    }
    return 360;
  });
  const rightColWidthRef = useRef(rightColWidth);
  useEffect(() => { rightColWidthRef.current = rightColWidth; });

  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const registerUndo = (undo: UndoAction) => setUndoAction(undo);
  const clearUndo = () => setUndoAction(null);
  const handleUndo = async () => {
    if (!undoAction) return;
    const action = undoAction;
    setUndoAction(null);
    await action.run();
  };

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightColWidthRef.current;

    const onMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 320), 600);
      setRightColWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("planner-right-col-width", String(rightColWidthRef.current));
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const today = getToday();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
      if (stored) setTargets(JSON.parse(stored));
    } catch {}
  }, []);

  const taskIdeas = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);
  const activeTaskIdeas = useMemo(
    () => taskIdeas.filter((i) => i.status !== "completed" && i.status !== "cancelled" && i.status !== "archived"),
    [taskIdeas],
  );

  const doneOnDate = useMemo(
    () => taskIdeas.filter((i) => i.completed_at && i.scheduled_date === activeDate),
    [taskIdeas, activeDate],
  );

  const pendingOnDate = useMemo(
    () => activeTaskIdeas.filter((i) => i.scheduled_date === activeDate && !i.scheduled_time),
    [activeTaskIdeas, activeDate],
  );

  const scheduledOnDate = useMemo(
    () => activeTaskIdeas.filter((i) => i.scheduled_date === activeDate && !!i.scheduled_time),
    [activeTaskIdeas, activeDate],
  );

  const inboxTasks = useMemo(() => activeTaskIdeas.filter((t) => !t.scheduled_date), [activeTaskIdeas]);

  const areaTaskCounts = useMemo(() => {
    const counts: Record<LifeArea, { pending: number; scheduled: number; done: number }> = {
      work: { pending: 0, scheduled: 0, done: 0 },
      health: { pending: 0, scheduled: 0, done: 0 },
      relationships: { pending: 0, scheduled: 0, done: 0 },
      growth: { pending: 0, scheduled: 0, done: 0 },
      finances: { pending: 0, scheduled: 0, done: 0 },
      life: { pending: 0, scheduled: 0, done: 0 },
    };
    const duration = (t: Idea) => t.duration_minutes ?? 30;
    for (const t of pendingOnDate) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const a of effectiveAreas) counts[a].pending += duration(t);
    }
    for (const t of scheduledOnDate) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const a of effectiveAreas) counts[a].scheduled += duration(t);
    }
    for (const t of doneOnDate) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const a of effectiveAreas) counts[a].done += duration(t);
    }
    return counts;
  }, [pendingOnDate, scheduledOnDate, doneOnDate, taskTagsHook]);

  const balanceRingCounts = useMemo(() => {
    const counts: Record<LifeArea, number> = { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
    for (const area of AREA_ORDER) counts[area] = areaTaskCounts[area].pending + areaTaskCounts[area].scheduled + areaTaskCounts[area].done;
    return counts;
  }, [areaTaskCounts]);

  const visibleAreas = selectedArea ? [selectedArea] : AREA_ORDER;

  const handleAddToArea = async (text: string, area: LifeArea) => {
    const id = await createIdea(text, null, "bottom", { type: "task", scheduled_date: activeDate, status: "planned" });
    // Auto-tag with the system tag for this area if it exists
    if (id) {
      const systemTag = tagsHook.tags.find((t) => t.is_system && t.area === area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
  };

  const handleMoveTaskBetweenAreas = async (taskId: string, fromArea: LifeArea, toArea: LifeArea) => {
    const sourceTag = tagsHook.tags.find((t) => t.is_system && t.area === fromArea);
    if (sourceTag) await taskTagsHook.removeTagFromTask(taskId, sourceTag.id).catch(() => {});
    const targetTag = tagsHook.tags.find((t) => t.is_system && t.area === toArea);
    if (targetTag) await taskTagsHook.addTagToTask(taskId, targetTag).catch(() => {});
  };

  const handleAdd = async (text: string, scheduledDate: string | null) => {
    await createIdea(text, null, "top", { type: "task", scheduled_date: scheduledDate ?? activeDate, status: "planned" });
  };

  const handleCreateScheduledTask = async (text: string, time: string, area?: LifeArea) => {
    const id = await createIdea(text, null, "bottom", { type: "task", scheduled_date: activeDate, scheduled_time: time, status: "scheduled" });
    if (id && area) {
      const tag = tagsHook.tags.find((t) => t.is_system && t.area === area);
      if (tag) await taskTagsHook.addTagToTask(id, tag);
    }
  };

  const handleReschedule = useCallback(async (id: string, action: RescheduleAction) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const patch = computeReschedulePatch(idea, action);
    await updateIdea(id, patch);
  }, [ideas, updateIdea]);

  const handleComplete = useCallback(async (id: string) => {
    const patch = computeCompletePatch();
    await updateIdea(id, patch);
  }, [updateIdea]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    await deleteIdea(id);
    if (!idea) return;
    registerUndo({
      label: "Task deleted",
      run: async () => {
        await restoreIdeas([idea]);
      },
    });
  }, [ideas, deleteIdea, restoreIdeas]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading planner...</div>
      </div>
    );
  }

  return (
    <AppShell
      title="Daily Planner"
      onAdd={handleAdd}
      fullWidth
      headerActions={
        <DateNav
          activeDate={activeDate}
          today={today}
          showDateInput={showDateInput}
          onShowDateInput={setShowDateInput}
          onChangeDate={setActiveDate}
          onGoToday={() => setActiveDate(today)}
        />
      }
    >
      {/* Mobile Tab Control */}
      <div className="sticky top-[53px] z-10 md:hidden bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl mb-4 gap-1">
        {[
          { id: "tasks", label: "Tasks", icon: Layers },
          { id: "schedule", label: "Schedule", icon: Clock },
          { id: "backlog", label: "Backlog", icon: Inbox },
          { id: "balance", label: "Balance", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMobileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMobileTab(tab.id as typeof activeMobileTab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-gray-800 shadow-sm text-gray-800 dark:text-gray-100 font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {undoAction && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center justify-between gap-3 rounded-[16px] glass-card border-amber-200/40 dark:border-amber-700/30 px-4 py-2.5"
        >
          <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">{undoAction.label}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
            >
              Undo
            </button>
            <button
              onClick={clearUndo}
              aria-label="Dismiss undo"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
            >
              <span className="text-sm">&times;</span>
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row gap-5">
        {/* LEFT COLUMN */}
        <div className={`w-full md:w-[260px] flex-shrink-0 space-y-4 ${activeMobileTab === "balance" ? "block" : "hidden md:block"} md:sticky md:top-[53px] md:self-start`}>
          <BalanceRing counts={balanceRingCounts} modeLabel="Work-Life Balance Ring" statLabel="Total Minutes" statSub="scheduled today" />
          <AreaFilters
            areaTaskCounts={areaTaskCounts}
            selectedArea={selectedArea}
            onSelectArea={(area) => setSelectedArea(selectedArea === area ? null : area)}
            targets={targets}
          />
        </div>

        {/* MIDDLE COLUMN */}
        <div className={`flex-1 min-w-0 space-y-4 ${activeMobileTab === "tasks" ? "block" : "hidden md:block"}`}>
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4 border border-black/5 dark:border-white/5">
            <div className="flex flex-col">
              <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {selectedArea ? `${AREA_LABELS[selectedArea]} Focus` : "Today's Agenda"}
              </h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                {pendingOnDate.length + scheduledOnDate.length} pending tasks · {doneOnDate.length} completed
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingOnDate.length > 0 && (
                <button
                  onClick={() => smartSortTasks(pendingOnDate)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                  title="Prioritize tasks by priority score"
                >
                  <Sparkles size={12} />
                  <span>Smart Sort</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {visibleAreas.map((area) => {
              const pending = [...pendingOnDate, ...scheduledOnDate].filter((t) => {
                const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
                return areas.length === 0 ? area === "life" : areas.includes(area);
              });
              const done = doneOnDate.filter((t) => {
                const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
                return areas.length === 0 ? area === "life" : areas.includes(area);
              });
              if (pending.length === 0 && done.length === 0 && selectedArea !== area) return null;
              return (
                <AreaTaskGroup
                  key={area}
                  area={area}
                  activeDate={activeDate}
                  pendingTasks={pending}
                  doneTasks={done}
                  onDone={markDone}
                  onUndone={markUndone}
                  onUpdate={updateIdea}
                  onReschedule={handleReschedule}
                  onDelete={handleDeleteTask}
                  onAddTask={handleAddToArea}
                  onReorderTasks={reorderTasks}
                  onMoveTaskBetweenAreas={handleMoveTaskBetweenAreas}
                  getTagsForIdea={taskTagsHook.getTagsForIdea}
                  allTags={tagsHook.tags}
                  onCreateTag={tagsHook.createTag}
                />
              );
            })}

            {pendingOnDate.length === 0 && scheduledOnDate.length === 0 && doneOnDate.length === 0 && (
              <div className="glass-card rounded-2xl text-center py-20 text-gray-400 dark:text-gray-500 border border-dashed border-black/5 dark:border-white/5">
                <Calendar size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 opacity-60" />
                <p className="text-sm font-semibold mb-1">
                  No tasks planned for {activeDate === today ? "today" : activeDate === offsetDate(today, 1) ? "tomorrow" : activeDate}
                </p>
                <p className="text-xs">Create a task in one of the areas, or pull from your backlog.</p>
              </div>
            )}
          </div>
        </div>

        {/* RESIZE HANDLE */}
        <div
          onMouseDown={handleResizeStart}
          className="w-3 flex-shrink-0 cursor-col-resize group hidden md:flex items-center justify-center"
        >
          <div className="flex flex-col gap-[3px] group-hover:opacity-100 opacity-40 transition-opacity">
            <div className="w-[3px] h-[3px] rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-violet-400" />
            <div className="w-[3px] h-[3px] rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-violet-400" />
            <div className="w-[3px] h-[3px] rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-violet-400" />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ "--right-col-width": `${rightColWidth}px` } as React.CSSProperties} className={`resizable-right-col flex-shrink-0 flex flex-col gap-4 w-full ${
          activeMobileTab === "schedule" || activeMobileTab === "backlog" ? "block" : "hidden lg:flex"
        }`}>
          <div className="glass-card rounded-2xl p-1 flex gap-1 border border-black/5 dark:border-white/5">
            {[
              { id: "schedule", label: "Schedule View", icon: Clock },
              { id: "backlog", label: "Backlog Inbox", icon: Inbox },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = (activeMobileTab === "schedule" || activeMobileTab === "backlog")
                ? activeMobileTab === tab.id
                : rightPanelTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (activeMobileTab === "schedule" || activeMobileTab === "backlog") {
                      setActiveMobileTab(tab.id as typeof activeMobileTab);
                    } else {
                      setRightPanelTab(tab.id as typeof rightPanelTab);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-gray-800 shadow-sm text-violet-600 dark:text-violet-400 font-bold"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-[400px]">
            {((activeMobileTab === "schedule") || (activeMobileTab !== "backlog" && rightPanelTab === "schedule")) ? (
              <DayslotTimeline
                activeDate={activeDate}
                allTasks={[...pendingOnDate, ...scheduledOnDate, ...doneOnDate]}
                onUpdateTask={updateIdea}
                onCreateTask={handleCreateScheduledTask}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
                tags={tagsHook.tags}
                selectedArea={selectedArea}
                onChangeTaskArea={handleMoveTaskBetweenAreas}
                onAddTag={async (ideaId, tag) => { await taskTagsHook.addTagToTask(ideaId, tag); }}
                onRemoveTag={async (ideaId, tagId) => { await taskTagsHook.removeTagFromTask(ideaId, tagId); }}
                onCreateTag={async (name, area) => {
                  const tag = await tagsHook.createTag(name, area);
                  return tag ?? null;
                }}
              />
            ) : (
              <InboxDeferredPanel
                compact
                activeDate={activeDate}
                today={today}
                inboxTasks={inboxTasks}
                onCreateInboxTask={async (text) => {
                  await createIdea(text, null, "top", { type: "task", status: "inbox" });
                }}
                onScheduleToDate={async (id) => {
                  const idea = ideas.find((i) => i.id === id);
                  if (!idea) return;
                  const patch = computeReschedulePatch(idea, { type: "reschedule", newDate: activeDate });
                  await updateIdea(id, patch);
                }}
                overdueBuckets={overdueBuckets}
                deferredTasks={deferredTasks}
                onReschedule={handleReschedule}
                onComplete={handleComplete}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
