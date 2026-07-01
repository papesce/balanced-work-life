"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Calendar, Layers, Clock, Inbox, BarChart3 } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { BalanceRing } from "@/components/BalanceRing";
import { Idea, LifeArea, getAreasForIdea } from "@/lib/types";
import { getToday, toLocalDateString } from "@/lib/dateUtils";
import { DateNav } from "@/components/planner/DateNav";
import { AreaFilters } from "@/components/planner/AreaFilters";
import { ScheduleGrid } from "@/components/planner/ScheduleGrid";
import { AreaTaskGroup } from "@/components/planner/AreaTaskGroup";
import { BacklogCard } from "@/components/planner/BacklogCard";
import { AREA_ORDER, AREA_LABELS, DEFAULT_TARGETS, LOCAL_STORAGE_TARGETS_KEY } from "@/components/planner/constants";
import { offsetDate } from "@/components/planner/plannerUtils";

export default function DailyPlannerPage() {
  return (
    <Suspense>
      <DailyPlannerInner />
    </Suspense>
  );
}

function DailyPlannerInner() {
  const { ideas, loading, createIdea, updateIdea, deleteIdea, markDone, markUndone, reorderTasks, smartSortTasks } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const searchParams = useSearchParams();
  const [activeDate, setActiveDate] = useState<string>(() => searchParams.get("date") ?? getToday());

  useEffect(() => {
    const d = searchParams.get("date");
    if (d) setActiveDate(d);
  }, [searchParams]);

  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"tasks" | "schedule" | "backlog" | "balance">("tasks");
  const [rightPanelTab, setRightPanelTab] = useState<"schedule" | "backlog">("schedule");
  const [targets, setTargets] = useState<Record<LifeArea, number>>(DEFAULT_TARGETS);
  const [showDateInput, setShowDateInput] = useState(false);

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
    () => taskIdeas.filter((i) => i.completed_at && i.scheduled_date === activeDate && toLocalDateString(new Date(i.completed_at)) === activeDate),
    [taskIdeas, activeDate],
  );

  const pendingOnDate = useMemo(
    () => activeTaskIdeas.filter((i) => i.scheduled_date === activeDate),
    [activeTaskIdeas, activeDate],
  );

  const inboxTasks = useMemo(() => activeTaskIdeas.filter((t) => !t.scheduled_date), [activeTaskIdeas]);

  const areaTaskCounts = useMemo(() => {
    const counts: Record<LifeArea, { pending: number; done: number }> = {
      work: { pending: 0, done: 0 },
      health: { pending: 0, done: 0 },
      relationships: { pending: 0, done: 0 },
      growth: { pending: 0, done: 0 },
      finances: { pending: 0, done: 0 },
      life: { pending: 0, done: 0 },
    };
    for (const t of pendingOnDate) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const a of effectiveAreas) counts[a].pending++;
    }
    for (const t of doneOnDate) {
      const areas = getAreasForIdea(taskTagsHook.getTagsForIdea(t.id));
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      for (const a of effectiveAreas) counts[a].done++;
    }
    return counts;
  }, [pendingOnDate, doneOnDate, taskTagsHook]);

  const balanceRingCounts = useMemo(() => {
    const counts: Record<LifeArea, number> = { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
    for (const area of AREA_ORDER) counts[area] = areaTaskCounts[area].pending;
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

  const handleAdd = async (text: string, scheduledDate: string | null) => {
    await createIdea(text, null, "top", { type: "task", scheduled_date: scheduledDate ?? activeDate, status: "planned" });
  };

  const handleCreateScheduledTask = async (text: string, time: string) => {
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: activeDate, scheduled_time: time, status: "scheduled" });
  };

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
      <div className="flex md:hidden bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl mb-4 gap-1">
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

      <div className="flex flex-col md:flex-row gap-5">
        {/* LEFT COLUMN */}
        <div className={`w-full md:w-[260px] flex-shrink-0 space-y-4 ${activeMobileTab === "balance" ? "block" : "hidden md:block"}`}>
          <BalanceRing counts={balanceRingCounts} modeLabel="Work-Life Balance Ring" statLabel="Active Tasks" statSub="scheduled today" />
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
                {pendingOnDate.length} pending tasks · {doneOnDate.length} completed
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
              const pending = pendingOnDate.filter((t) => {
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
                  onDelete={deleteIdea}
                  onAddTask={handleAddToArea}
                  onReorderTasks={reorderTasks}
                />
              );
            })}

            {pendingOnDate.length === 0 && doneOnDate.length === 0 && (
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

        {/* RIGHT COLUMN */}
        <div className={`w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-4 ${
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
              <ScheduleGrid
                activeDate={activeDate}
                allTasks={[...pendingOnDate, ...doneOnDate]}
                onUpdateTask={updateIdea}
                onCreateTask={handleCreateScheduledTask}
              />
            ) : (
              <BacklogCard
                tasks={inboxTasks}
                activeDate={activeDate}
                today={today}
                onScheduleToDate={async (id) => {
                  await updateIdea(id, { scheduled_date: activeDate, status: "planned" });
                }}
                onCreateInboxTask={async (text) => {
                  await createIdea(text, null, "top", { type: "task", status: "inbox" });
                }}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
