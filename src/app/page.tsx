"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Layers, Clock, BarChart3 } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { BalanceRing } from "@/components/BalanceRing";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";
import { DateNav } from "@/components/planner/DateNav";
import { AreaFilters } from "@/components/planner/AreaFilters";
import { DayslotTimeline } from "@/components/planner/DayslotTimeline";
import { AreaTaskGroup } from "@/components/planner/AreaTaskGroup";
import { UndoBar } from "@/components/shared/UndoBar";
import { AREA_DOT_COLORS, AREA_ORDER, AREA_LABELS, DEFAULT_TARGETS, LOCAL_STORAGE_TARGETS_KEY } from "@/lib/constants";
import { computeReschedulePatch, computeCompletePatch, computeCancelPatch, getDayOccurrences, getTriageMeta, DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { useUndoAction } from "@/lib/tasks/undo";
import { TriageActions } from "@/components/triage/TriageActions";
import { formatDayLabel } from "@/components/planner/plannerUtils";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeDate, setActiveDate] = useState<string>(() => searchParams.get("date") ?? getToday());
  const highlightId = searchParams.get("highlight");

  const urlDate = searchParams.get("date");
  const [prevUrlDate, setPrevUrlDate] = useState(urlDate);
  if (urlDate !== prevUrlDate) {
    setPrevUrlDate(urlDate);
    if (urlDate) setActiveDate(urlDate);
  }

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
  const [activeMobileTab, setActiveMobileTab] = useState<"tasks" | "schedule" | "balance">("tasks");
  const [targets] = useState<Record<LifeArea, number>>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
        if (stored) return JSON.parse(stored) as Record<LifeArea, number>;
      }
    } catch {}
    return DEFAULT_TARGETS;
  });
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

  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

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

  const taskIdeas = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);
  const scheduledTaskIdeas = useMemo(
    () => taskIdeas.filter((i) => i.status !== "completed" && i.status !== "archived"),
    [taskIdeas],
  );

  const doneOnDate = useMemo(
    () => taskIdeas.filter((i) => i.status === "completed" && i.scheduled_date === activeDate),
    [taskIdeas, activeDate],
  );

  const pendingOnDate = useMemo(
    () => scheduledTaskIdeas.filter((i) => i.scheduled_date === activeDate && !i.scheduled_time),
    [scheduledTaskIdeas, activeDate],
  );

  const scheduledOnDate = useMemo(
    () => scheduledTaskIdeas.filter((i) => i.scheduled_date === activeDate && !!i.scheduled_time),
    [scheduledTaskIdeas, activeDate],
  );

  const deferredOnDate = useMemo(
    () => getDayOccurrences(taskIdeas, activeDate, today).filter((o) => o.isHistorical),
    [taskIdeas, activeDate, today],
  );

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

  const dayIsEmpty =
    pendingOnDate.length === 0 && scheduledOnDate.length === 0 && doneOnDate.length === 0;

  const visibleAreas = selectedArea ? [selectedArea] : AREA_ORDER;

  const handleAddToArea = async (text: string, area: LifeArea) => {
    const id = await createIdea(text, null, "bottom", { type: "task", scheduled_date: activeDate, status: "planned" });
    // Auto-tag with the system tag for this area (created on demand if missing)
    if (id) {
      const systemTag = await tagsHook.getOrCreateSystemTag(area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
  };

  const handleMoveTaskBetweenAreas = async (taskId: string, fromArea: LifeArea, toArea: LifeArea) => {
    const sourceTag = tagsHook.tags.find((t) => t.is_system && t.area === fromArea);
    if (sourceTag) await taskTagsHook.removeTagFromTask(taskId, sourceTag.id).catch(() => {});
    const targetTag = await tagsHook.getOrCreateSystemTag(toArea);
    if (targetTag) await taskTagsHook.addTagToTask(taskId, targetTag).catch(() => {});
  };

  const handleAdd = async (text: string, scheduledDate: string | null) => {
    await createIdea(text, null, "top", { type: "task", scheduled_date: scheduledDate ?? activeDate, status: "planned" });
  };

  const handleCreateScheduledTask = async (text: string, time: string, area?: LifeArea) => {
    const id = await createIdea(text, null, "bottom", { type: "task", scheduled_date: activeDate, scheduled_time: time, status: "scheduled" });
    if (id && area) {
      const tag = await tagsHook.getOrCreateSystemTag(area);
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

  const handleCancel = useCallback(async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const previous = idea;
    const patch = computeCancelPatch();
    await updateIdea(id, patch);
    registerUndo({
      label: "Task cancelled",
      run: async () => {
        await updateIdea(id, { status: previous.status, cancelled_at: null });
      },
    });
  }, [ideas, updateIdea, registerUndo]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const collectSubtree = (rootId: string): Set<string> => {
      const ids = new Set<string>();
      const walk = (nodeId: string) => {
        ids.add(nodeId);
        ideas.filter((i) => i.parent_id === nodeId).forEach((child) => walk(child.id));
      };
      walk(rootId);
      return ids;
    };
    const deletedIds = collectSubtree(id);
    const deletedIdeas = ideas.filter((i) => deletedIds.has(i.id));
    await deleteIdea(id);
    if (deletedIdeas.length === 0) return;
    registerUndo({
      label: deletedIdeas.length > 1 ? "Tasks deleted" : "Task deleted",
      run: async () => {
        await restoreIdeas(deletedIdeas);
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
      <div className="sticky top-[52px] z-10 md:hidden flex bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg border border-black/5 dark:border-white/5 p-1.5 rounded-2xl mb-4 gap-1 shadow-sm">
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
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-violet-600 dark:bg-violet-500 shadow-md text-white dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

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

          {deferredOnDate.length > 0 && (
            <DeferredOnDateSection
              occurrences={deferredOnDate}
              today={today}
              onReschedule={handleReschedule}
              onComplete={handleComplete}
              onCancel={handleCancel}
              getTagsForIdea={taskTagsHook.getTagsForIdea}
            />
          )}

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
              if (pending.length === 0 && done.length === 0 && selectedArea !== area && !dayIsEmpty) return null;
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
                  onAddTag={async (ideaId, tag) => { await taskTagsHook.addTagToTask(ideaId, tag); }}
                  onRemoveTag={async (ideaId, tagId) => { await taskTagsHook.removeTagFromTask(ideaId, tagId); }}
                />
              );
            })}
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
          activeMobileTab === "schedule" ? "block" : "hidden lg:flex"
        }`}>
          <div className="flex-1 min-h-[400px]">
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
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DeferredOnDateSection({
  occurrences,
  today,
  onReschedule,
  onComplete,
  onCancel,
  getTagsForIdea,
}: {
  occurrences: DayOccurrence[];
  today: string;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-amber-200/40 dark:border-amber-800/30">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200/30 dark:border-amber-800/20 bg-amber-50/40 dark:bg-amber-950/10">
        <Clock size={13} className="text-amber-500" />
        <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400">
          Deferred to this day
        </h2>
        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
          {occurrences.length}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {occurrences.map(({ task }) => {
          const meta = getTriageMeta(task);
          const tags = getTagsForIdea(task.id);
          return (
            <div key={task.id} className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
                  {task.text}
                </span>
                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  Deferred
                </span>
              </div>
              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {tags.map((tag) => (
                    <span key={tag.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${AREA_DOT_COLORS[tag.area]}`} />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {task.scheduled_date
                    ? `Moved to ${formatDayLabel(task.scheduled_date, today)}`
                    : meta.movedToLabel}
                </span>
                <TriageActions
                  task={task}
                  onReschedule={onReschedule}
                  onComplete={onComplete}
                  onCancel={onCancel}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
