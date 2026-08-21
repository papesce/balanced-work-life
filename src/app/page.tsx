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
import { AREA_DOT_COLORS, AREA_ORDER, AREA_LABELS } from "@/lib/constants";
import {
  computeReschedulePatch,
  computeCompletePatch,
  computeCancelPatch,
  getDayOccurrences,
  getTriageMeta,
  DayOccurrence,
  RescheduleAction,
} from "@/lib/tasks/rescheduleTask";
import { useUndoAction } from "@/lib/tasks/undo";
import { TriageActions } from "@/components/triage/TriageActions";
import { formatDayLabel } from "@/components/planner/plannerUtils";
import { STORAGE_KEYS, loadAreaTargets, readRawString, writeRawString } from "@/lib/storage";

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
  const [targets] = useState<Record<LifeArea, number>>(() => loadAreaTargets());
  const [showDateInput, setShowDateInput] = useState(false);
  const [rightColWidth, setRightColWidth] = useState<number>(() => {
    const saved = readRawString(STORAGE_KEYS.plannerRightColWidth);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= 320 && n <= 600) return n;
    }
    return 360;
  });
  const rightColWidthRef = useRef(rightColWidth);
  useEffect(() => {
    rightColWidthRef.current = rightColWidth;
  });

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
      writeRawString(STORAGE_KEYS.plannerRightColWidth, String(rightColWidthRef.current));
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
    const counts: Record<LifeArea, number> = {
      work: 0,
      health: 0,
      relationships: 0,
      growth: 0,
      finances: 0,
      life: 0,
    };
    for (const area of AREA_ORDER)
      counts[area] =
        areaTaskCounts[area].pending + areaTaskCounts[area].scheduled + areaTaskCounts[area].done;
    return counts;
  }, [areaTaskCounts]);

  const dayIsEmpty =
    pendingOnDate.length === 0 && scheduledOnDate.length === 0 && doneOnDate.length === 0;

  const visibleAreas = selectedArea ? [selectedArea] : AREA_ORDER;

  const handleAddToArea = async (text: string, area: LifeArea) => {
    const id = await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: activeDate,
      status: "planned",
    });
    // Auto-tag with the system tag for this area (created on demand if missing)
    if (id) {
      const systemTag = await tagsHook.getOrCreateSystemTag(area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
  };

  const handleMoveTaskBetweenAreas = async (
    taskId: string,
    fromArea: LifeArea,
    toArea: LifeArea,
  ) => {
    const sourceTag = tagsHook.tags.find((t) => t.is_system && t.area === fromArea);
    if (sourceTag) await taskTagsHook.removeTagFromTask(taskId, sourceTag.id).catch(() => {});
    const targetTag = await tagsHook.getOrCreateSystemTag(toArea);
    if (targetTag) await taskTagsHook.addTagToTask(taskId, targetTag).catch(() => {});
  };

  const handleCreateScheduledTask = async (
    text: string,
    time: string,
    area?: LifeArea,
    tag?: Tag,
  ) => {
    const id = await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: activeDate,
      scheduled_time: time,
      status: "scheduled",
    });
    if (id && area) {
      const systemTag = await tagsHook.getOrCreateSystemTag(area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
    if (id && tag && !tag.is_system) {
      await taskTagsHook.addTagToTask(id, tag);
    }
  };

  const handleReschedule = useCallback(
    async (id: string, action: RescheduleAction) => {
      const idea = ideas.find((i) => i.id === id);
      if (!idea) return;
      const patch = computeReschedulePatch(idea, action);
      await updateIdea(id, patch);
    },
    [ideas, updateIdea],
  );

  const handleComplete = useCallback(
    async (id: string) => {
      const patch = computeCompletePatch();
      await updateIdea(id, patch);
    },
    [updateIdea],
  );

  const handleCancel = useCallback(
    async (id: string) => {
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
    },
    [ideas, updateIdea, registerUndo],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
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
    },
    [ideas, deleteIdea, restoreIdeas, registerUndo],
  );

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

      <div className="flex flex-col gap-5 md:flex-row">
        {/* LEFT COLUMN */}
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
            onSelectArea={(area) => setSelectedArea(selectedArea === area ? null : area)}
            targets={targets}
          />
        </div>

        {/* MIDDLE COLUMN */}
        <div
          className={`min-w-0 flex-1 space-y-4 ${activeMobileTab === "tasks" ? "block" : "hidden md:block"}`}
        >
          <div className="glass-card flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-4 dark:border-white/5">
            <div className="flex flex-col">
              <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {selectedArea ? `${AREA_LABELS[selectedArea]} Focus` : "Today's Agenda"}
              </h2>
              <p className="mt-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                {pendingOnDate.length + scheduledOnDate.length} pending tasks · {doneOnDate.length}{" "}
                completed
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingOnDate.length > 0 && (
                <button
                  onClick={() => smartSortTasks(pendingOnDate)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-600 transition-all hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
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
              if (pending.length === 0 && done.length === 0 && selectedArea !== area && !dayIsEmpty)
                return null;
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
                  onAddTag={async (ideaId, tag) => {
                    await taskTagsHook.addTagToTask(ideaId, tag);
                  }}
                  onRemoveTag={async (ideaId, tagId) => {
                    await taskTagsHook.removeTagFromTask(ideaId, tagId);
                  }}
                />
              );
            })}
          </div>
        </div>

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

        {/* RIGHT COLUMN */}
        <div
          style={{ "--right-col-width": `${rightColWidth}px` } as React.CSSProperties}
          className={`resizable-right-col flex w-full flex-shrink-0 flex-col gap-4 ${
            activeMobileTab === "schedule" ? "block" : "hidden lg:flex"
          }`}
        >
          <div className="min-h-[400px] flex-1">
            <DayslotTimeline
              activeDate={activeDate}
              allTasks={[...pendingOnDate, ...scheduledOnDate, ...doneOnDate]}
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
    <div className="glass-card overflow-hidden rounded-2xl border border-amber-200/40 dark:border-amber-800/30">
      <div className="flex items-center gap-2 border-b border-amber-200/30 bg-amber-50/40 px-4 py-3 dark:border-amber-800/20 dark:bg-amber-950/10">
        <Clock size={13} className="text-amber-500" />
        <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400">
          Deferred to this day
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
          {occurrences.length}
        </span>
      </div>
      <div className="space-y-2 p-3">
        {occurrences.map(({ task }) => {
          const meta = getTriageMeta(task);
          const tags = getTagsForIdea(task.id);
          return (
            <div
              key={task.id}
              className="flex flex-col gap-2 rounded-xl border border-black/5 bg-white/60 p-3 dark:border-white/5 dark:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex-1 text-xs leading-snug font-semibold text-gray-700 dark:text-gray-200">
                  {task.text}
                </span>
                <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Deferred
                </span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold"
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
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
