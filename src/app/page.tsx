"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, Reorder } from "framer-motion";
import {
  Check,
  Star,
  MoreHorizontal,
  GripVertical,
  Briefcase,
  Heart,
  Users,
  Sparkles,
  Coins,
  Compass,
  Inbox,
  X,
  ChevronRight,
  ChevronLeft,
  Clock,
  CalendarDays,
  Calendar,
  Layers,
  BarChart3,
  Plus
} from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { Idea, LifeArea } from "@/lib/types";
import { getToday, formatDate, toLocalDateString } from "@/lib/dateUtils";
import { areaColors } from "@/styles/tokens";
import { BalanceRing } from "@/components/BalanceRing";

const AREA_ORDER: LifeArea[] = ["work", "health", "relationships", "growth", "finances", "life"];

const AREA_LABELS: Record<LifeArea, string> = {
  work: "Work",
  health: "Health",
  relationships: "Relationships",
  growth: "Growth",
  finances: "Finances",
  life: "Life",
};

const AREA_ICONS: Record<LifeArea, React.ElementType> = {
  work: Briefcase,
  health: Heart,
  relationships: Users,
  growth: Sparkles,
  finances: Coins,
  life: Compass,
};

const DEFAULT_TARGETS: Record<LifeArea, number> = {
  work: 35,
  health: 15,
  relationships: 15,
  growth: 15,
  finances: 10,
  life: 10,
};

const LOCAL_STORAGE_TARGETS_KEY = "daily-planner-area-targets";

const SCHEDULE_HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

function offsetDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function formatDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Today";
  if (dateStr === offsetDate(todayStr, 1)) return "Tomorrow";
  if (dateStr === offsetDate(todayStr, -1)) return "Yesterday";
  return formatDate(dateStr);
}

function formatTime(raw: string): string {
  const [h, m] = raw.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return m === "00" ? `${display}${suffix}` : `${display}:${m}${suffix}`;
}

export default function DailyPlannerPage() {
  const { ideas, loading, createIdea, updateIdea, deleteIdea, markDone, markUndone, reorderTasks, smartSortTasks } = useIdeas();
  const searchParams = useSearchParams();
  const [activeDate, setActiveDate] = useState<string>(() => searchParams.get("date") ?? getToday());

  // Sync when URL param changes (e.g. navigating from Timeline)
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
  const activeTaskIdeas = useMemo(() => taskIdeas.filter((i) => !i.done_at), [taskIdeas]);

  const doneOnDate = useMemo(
    () => taskIdeas.filter((i) => i.done_at && i.scheduled_date === activeDate && toLocalDateString(new Date(i.done_at)) === activeDate),
    [taskIdeas, activeDate]
  );

  const pendingOnDate = useMemo(
    () => activeTaskIdeas.filter((i) => i.scheduled_date === activeDate),
    [activeTaskIdeas, activeDate]
  );

  const inboxTasks = useMemo(
    () => activeTaskIdeas.filter((t) => !t.scheduled_date),
    [activeTaskIdeas]
  );

  const areaTaskCounts = useMemo(() => {
    const counts: Record<LifeArea, { pending: number; done: number }> = {
      work: { pending: 0, done: 0 },
      health: { pending: 0, done: 0 },
      relationships: { pending: 0, done: 0 },
      growth: { pending: 0, done: 0 },
      finances: { pending: 0, done: 0 },
      life: { pending: 0, done: 0 },
    };
    for (const t of pendingOnDate) counts[t.area ?? "life"].pending++;
    for (const t of doneOnDate) counts[t.area ?? "life"].done++;
    return counts;
  }, [pendingOnDate, doneOnDate]);

  // Construct counts for BalanceRing based on active tasks today
  const balanceRingCounts = useMemo(() => {
    const counts: Record<LifeArea, number> = {
      work: 0,
      health: 0,
      relationships: 0,
      growth: 0,
      finances: 0,
      life: 0,
    };
    for (const area of AREA_ORDER) {
      counts[area] = areaTaskCounts[area].pending;
    }
    return counts;
  }, [areaTaskCounts]);

  const visibleAreas = selectedArea ? [selectedArea] : AREA_ORDER;

  const handleAddToArea = async (text: string, area: LifeArea) => {
    await createIdea(text, null, "bottom", {
      type: "task",
      area,
      scheduled_date: activeDate,
      status: "scheduled",
    });
  };

  const handleAdd = async (text: string, area: LifeArea, scheduledDate: string | null) => {
    await createIdea(text, null, "top", {
      type: "task",
      area,
      scheduled_date: scheduledDate ?? activeDate,
      status: "scheduled",
    });
  };

  const handleCreateScheduledTask = async (text: string, time: string, area: LifeArea) => {
    await createIdea(text, null, "bottom", {
      type: "task",
      area,
      scheduled_date: activeDate,
      scheduled_time: time,
      status: "scheduled",
    });
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
              onClick={() => setActiveMobileTab(tab.id as any)}
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
        {/* LEFT COLUMN: Balance Overview & Filters (Desktop: always visible, Mobile: only under 'balance' tab) */}
        <div className={`w-full md:w-[260px] flex-shrink-0 space-y-4 ${
          activeMobileTab === "balance" ? "block" : "hidden md:block"
        }`}>
          {/* Live Balance Ring */}
          <BalanceRing
            counts={balanceRingCounts}
            modeLabel="Work-Life Balance Ring"
            statLabel="Active Tasks"
            statSub="scheduled today"
          />

          {/* Area Filters */}
          <AreaFilters
            areaTaskCounts={areaTaskCounts}
            selectedArea={selectedArea}
            onSelectArea={(area) => setSelectedArea(selectedArea === area ? null : area)}
            targets={targets}
          />
        </div>

        {/* MIDDLE COLUMN: Today's Tasks Feed (Desktop: always visible, Mobile: only under 'tasks' tab) */}
        <div className={`flex-1 min-w-0 space-y-4 ${
          activeMobileTab === "tasks" ? "block" : "hidden md:block"
        }`}>
          {/* Quick stats and prioritization card */}
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

          {/* Life Area Task Groups */}
          <div className="space-y-4">
            {visibleAreas.map((area) => {
              const pending = pendingOnDate.filter((t) => (t.area ?? "life") === area);
              const done = doneOnDate.filter((t) => (t.area ?? "life") === area);
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
                  No tasks planned for {formatDayLabel(activeDate, today).toLowerCase()}
                </p>
                <p className="text-xs">
                  Create a task in one of the areas, or pull from your backlog.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Planning Sidebar (Desktop: always visible, Mobile: only under 'schedule' or 'backlog' tab) */}
        <div className={`w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-4 ${
          activeMobileTab === "schedule" || activeMobileTab === "backlog"
            ? "block"
            : "hidden lg:flex"
        }`}>
          {/* Tab Selector for desktop sidebar */}
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
                      setActiveMobileTab(tab.id as any);
                    } else {
                      setRightPanelTab(tab.id as any);
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

          {/* Right Panel View Components */}
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
                onScheduleToDate={async (id, area) => {
                  await updateIdea(id, { scheduled_date: activeDate, area, status: "scheduled" });
                }}
                onCreateInboxTask={async (text) => {
                  await createIdea(text, null, "top", { type: "task", status: "inbox" });
                }}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Date Nav Component ──────────────────────────────────────────────────────

function DateNav({
  activeDate,
  today,
  showDateInput,
  onShowDateInput,
  onChangeDate,
  onGoToday,
}: {
  activeDate: string;
  today: string;
  showDateInput: boolean;
  onShowDateInput: (v: boolean) => void;
  onChangeDate: (d: string) => void;
  onGoToday: () => void;
}) {
  const label = formatDayLabel(activeDate, today);
  const isToday = activeDate === today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChangeDate(offsetDate(activeDate, -1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
      >
        <ChevronLeft size={15} />
      </button>

      {showDateInput ? (
        <input
          type="date"
          defaultValue={activeDate}
          autoFocus
          onChange={(e) => {
            if (e.target.value) {
              onChangeDate(e.target.value);
              onShowDateInput(false);
            }
          }}
          onBlur={() => onShowDateInput(false)}
          className="text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      ) : (
        <button
          onClick={() => onShowDateInput(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          <CalendarDays size={13} className="text-gray-400" />
          {label}
        </button>
      )}

      <button
        onClick={() => onChangeDate(offsetDate(activeDate, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
      >
        <ChevronRight size={15} />
      </button>

      {!isToday && (
        <button
          onClick={onGoToday}
          className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all cursor-pointer"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ─── Upgraded Area Filters Component ─────────────────────────────────────────

function AreaFilters({
  areaTaskCounts,
  selectedArea,
  onSelectArea,
  targets,
}: {
  areaTaskCounts: Record<LifeArea, { pending: number; done: number }>;
  selectedArea: LifeArea | null;
  onSelectArea: (area: LifeArea) => void;
  targets: Record<LifeArea, number>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Life Area Filters
        </p>
        {selectedArea && (
          <button
            onClick={() => onSelectArea(selectedArea)}
            className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {AREA_ORDER.map((area) => {
          const { pending, done } = areaTaskCounts[area];
          const Icon = AREA_ICONS[area];
          const isSelected = selectedArea === area;
          const color = areaColors[area]?.dot;
          const targetPct = targets[area] ?? 0;

          // Calculate actual percentage of total pending tasks
          const totalPending = Object.values(areaTaskCounts).reduce((sum, item) => sum + item.pending, 0);
          const actualPct = totalPending > 0 ? Math.round((pending / totalPending) * 100) : 0;

          return (
            <button
              key={area}
              onClick={() => onSelectArea(area)}
              className={`w-full flex flex-col gap-1.5 p-3 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-white dark:bg-white/[0.08] border-violet-500/30 shadow-md scale-[1.01]"
                  : "bg-white/40 dark:bg-white/[0.015] border-black/[0.03] dark:border-white/[0.02] hover:bg-white/70 dark:hover:bg-white/[0.04] hover:border-black/5 dark:hover:border-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-5.5 h-5.5 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: areaColors[area]?.bg }}
                >
                  <Icon size={12} style={{ color }} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${
                    isSelected ? "text-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {AREA_LABELS[area]}
                  </p>
                </div>

                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                  {pending > 0 ? `${pending} pending` : done > 0 ? "✓ done" : "0"}
                </div>
              </div>

              {/* Progress visual indicators */}
              <div className="w-full space-y-1">
                <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500">
                  <span>Target: {targetPct}%</span>
                  {pending > 0 && <span>Actual: {actualPct}%</span>}
                </div>
                
                <div className="w-full h-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden flex">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, actualPct)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schedule Grid Component ────────────────────────────────────────────────

function ScheduleGrid({
  activeDate,
  allTasks,
  onUpdateTask,
  onCreateTask,
}: {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (text: string, time: string, area: LifeArea) => Promise<void>;
}) {
  const [activeInputHour, setActiveInputHour] = useState<string | null>(null);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputArea, setInputArea] = useState<LifeArea>("life");

  const scheduledTasks = allTasks.filter((t) => t.scheduled_time && t.status !== "archived");

  const handleCreate = async (hour: string) => {
    if (!inputText.trim()) return;
    await onCreateTask(inputText.trim(), hour, inputArea);
    setInputText("");
    setActiveInputHour(null);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 flex flex-col h-[650px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex-shrink-0">
        <Clock size={14} className="text-gray-400" />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Daily Timeline</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {SCHEDULE_HOURS.map((hour) => {
          const hourKey = hour.split(":")[0];
          const tasksInSlot = scheduledTasks.filter(
            (t) => t.scheduled_time?.split(":")[0] === hourKey
          );
          const isActive = activeInputHour === hour;
          const isDragOver = dragOverHour === hour;

          return (
            <div
              key={hour}
              className={`flex items-start gap-3 px-4 py-2.5 group transition-colors duration-150 relative ${
                isDragOver ? "bg-violet-500/10 border-y border-dashed border-violet-500/30" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverHour(hour);
              }}
              onDragLeave={() => {
                setDragOverHour(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverHour(null);
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) {
                  onUpdateTask(taskId, { scheduled_time: hour });
                }
              }}
            >
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 w-10 pt-1.5 tabular-nums flex-shrink-0">
                {formatTime(hour)}
              </span>

              <div className="flex-1 space-y-1.5 min-w-0">
                {tasksInSlot.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="flex items-center gap-2 text-xs cursor-grab active:cursor-grabbing hover:bg-black/5 dark:hover:bg-white/5 rounded-lg p-1.5 -mx-1 border border-black/[0.02] dark:border-white/[0.02] bg-white/40 dark:bg-white/[0.01]"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: areaColors[task.area ?? "life"]?.dot }}
                    />
                    <span
                      className={`flex-1 truncate font-medium text-[11px] ${
                        task.done_at
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {task.text}
                    </span>
                    {task.duration_minutes && (
                      <span className="text-[9px] bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-400 dark:text-gray-500 font-bold tabular-nums flex-shrink-0">
                        {task.duration_minutes}m
                      </span>
                    )}
                    <button
                      onClick={() => onUpdateTask(task.id, { scheduled_time: null })}
                      className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Unschedule task"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {isActive ? (
                  <div className="flex flex-col gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-xl border border-black/5 dark:border-white/5 mt-1">
                    <input
                      type="text"
                      placeholder="Add task to this hour..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreate(hour);
                        if (e.key === "Escape") setActiveInputHour(null);
                      }}
                      className="w-full bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-800 dark:text-gray-200"
                      autoFocus
                    />
                    
                    <div className="flex justify-between items-center gap-2">
                      <select
                        value={inputArea}
                        onChange={(e) => setInputArea(e.target.value as LifeArea)}
                        className="bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      >
                        {AREA_ORDER.map((a) => (
                          <option key={a} value={a}>{AREA_LABELS[a]}</option>
                        ))}
                      </select>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => setActiveInputHour(null)}
                          className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleCreate(hour)}
                          className="text-[10px] bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveInputHour(hour); setInputText(""); }}
                    className="w-full text-left text-[10px] text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100 py-1 cursor-pointer font-semibold"
                  >
                    + Schedule at {formatTime(hour)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Area Task Group Component ──────────────────────────────────────────────

function AreaTaskGroup({
  area,
  activeDate,
  pendingTasks,
  doneTasks,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onAddTask,
  onReorderTasks,
}: {
  area: LifeArea;
  activeDate: string;
  pendingTasks: Idea[];
  doneTasks: Idea[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onAddTask: (text: string, area: LifeArea) => Promise<void>;
  onReorderTasks: (taskIds: string[]) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const Icon = AREA_ICONS[area];
  const color = areaColors[area]?.dot;

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5 transition-all duration-200 ${
        isDragOver ? "ring-2 ring-violet-500/50 bg-violet-500/[0.03] scale-[1.005]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) {
          onUpdate(taskId, {
            area,
            status: "scheduled",
            scheduled_date: activeDate,
            scheduled_time: null,
          });
        }
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]"
        style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" }}
      >
        <div
          className="w-5.5 h-5.5 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: areaColors[area]?.bg }}
        >
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{AREA_LABELS[area]}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1 font-semibold">
          {pendingTasks.length} pending{doneTasks.length > 0 ? ` · ${doneTasks.length} completed` : ""}
        </span>
      </div>

      <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {pendingTasks.length > 0 && (
          <PendingTaskList
            tasks={pendingTasks}
            onReorder={onReorderTasks}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
        {doneTasks.map((task) => (
          <TaskRow key={task.id} task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 italic">No tasks planned for this day</div>
        )}
      </div>

      <div className="px-4 py-2 bg-black/[0.01] dark:bg-white/[0.01] border-t border-black/[0.02] dark:border-white/[0.02]">
        <input
          type="text"
          placeholder={`+ Add to ${AREA_LABELS[area]}...`}
          className="w-full bg-transparent border-none text-xs py-1.5 focus:ring-0 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-700 dark:text-gray-300 outline-none font-medium"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              void onAddTask(e.currentTarget.value.trim(), area);
              e.currentTarget.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Pending Task List Component ───────────────────────────────────────────

function PendingTaskList({
  tasks,
  onReorder,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
}: {
  tasks: Idea[];
  onReorder: (taskIds: string[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState(tasks);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setItems(tasks); }, [tasks]);

  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems}>
      {items.map((task) => (
        <Reorder.Item
          key={task.id}
          value={task}
          className="relative"
          onDragEnd={() => onReorder(itemsRef.current.map((t) => t.id))}
        >
          <TaskRow
            task={task}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onDelete={onDelete}
            showDragHandle
          />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

// ─── Task Row Component ─────────────────────────────────────────────────────

function TaskRow({
  task,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  showDragHandle,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  showDragHandle?: boolean;
}) {
  const isCompleted = !!task.done_at;
  const [showMenu, setShowMenu] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState(task.duration_minutes?.toString() ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) setShowDurationDropdown(false);
    };
    if (showMenu || showDurationDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showDurationDropdown]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex items-center gap-2 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors group cursor-grab active:cursor-grabbing"
    >
      {showDragHandle && (
        <div className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
          <GripVertical size={11} />
        </div>
      )}
      
      <button
        onClick={() => (isCompleted ? onUndone(task.id) : onDone(task.id))}
        className="w-4.5 h-4.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer"
        style={{
          borderColor: isCompleted ? "#7c3aed" : "var(--text-subtle, #9ca3af)",
          background: isCompleted ? "#7c3aed" : "transparent",
        }}
      >
        {isCompleted && <Check size={10} strokeWidth={4} className="text-white" />}
      </button>

      <span
        className={`flex-1 text-[13px] min-w-0 truncate ${
          isCompleted ? "line-through text-gray-400 dark:text-gray-500 font-normal" : "text-gray-700 dark:text-gray-200 font-semibold"
        }`}
      >
        {task.text}
      </span>

      {/* Sleek Custom Duration Picker */}
      <div className="relative" ref={durationRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDurationDropdown(!showDurationDropdown);
            setShowCustomInput(false);
          }}
          className={`text-[10px] tabular-nums font-bold flex-shrink-0 transition-colors rounded px-1.5 py-0.5 flex items-center gap-1 cursor-pointer ${
            task.duration_minutes
              ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-900/30"
              : "text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100"
          }`}
          title="Set task duration"
        >
          <Clock size={11} />
          {task.duration_minutes ? `${task.duration_minutes}m` : ""}
        </button>

        {showDurationDropdown && (
          <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[110px] space-y-1">
            {!showCustomInput ? (
              <>
                {[15, 30, 45, 60, 90, 120].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: preset });
                      setShowDurationDropdown(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 font-semibold cursor-pointer"
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 font-semibold cursor-pointer"
                >
                  Custom...
                </button>
                {task.duration_minutes && (
                  <button
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: null });
                      setShowDurationDropdown(false);
                    }}
                    className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 p-1">
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={customVal}
                  placeholder="Minutes"
                  autoFocus
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      setShowDurationDropdown(false);
                    }
                    if (e.key === "Escape") setShowCustomInput(false);
                  }}
                  className="w-full text-[10px] border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold"
                />
                <div className="flex justify-between gap-1 mt-1">
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="text-[9px] text-gray-400 hover:text-gray-600 px-1 py-0.5 cursor-pointer font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      const val = parseInt(customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      setShowDurationDropdown(false);
                    }}
                    className="text-[9px] text-violet-600 dark:text-violet-400 hover:text-violet-700 px-1.5 py-0.5 font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {task.scheduled_time && (
        <span className="text-[10px] text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 px-1.5 py-0.5 rounded flex-shrink-0 font-bold tabular-nums">
          {formatTime(task.scheduled_time)}
        </span>
      )}

      {/* Priority star and contextual menu */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
          className={`cursor-pointer ${task.is_priority ? "text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-400"}`}
        >
          <Star size={12} className={task.is_priority ? "fill-amber-400 text-amber-400" : ""} />
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 cursor-pointer">
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-lg py-1 min-w-[150px] shadow-lg border border-black/5 dark:border-white/5">
              <button
                onClick={() => { onUpdate(task.id, { scheduled_date: null, status: "inbox" }); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-semibold cursor-pointer"
              >
                Move to Backlog
              </button>
              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Backlog Card Sidebar Component ──────────────────────────────────────────

function BacklogCard({
  tasks,
  activeDate,
  today,
  onScheduleToDate,
  onCreateInboxTask,
}: {
  tasks: Idea[];
  activeDate: string;
  today: string;
  onScheduleToDate: (id: string, area: LifeArea) => Promise<void>;
  onCreateInboxTask: (text: string) => Promise<void>;
}) {
  const [inputText, setInputText] = useState("");
  const [showAreaSelectorForId, setShowAreaSelectorForId] = useState<string | null>(null);
  const dateLabel = formatDayLabel(activeDate, today);

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[650px] overflow-hidden border border-black/5 dark:border-white/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex-shrink-0">
        <h2 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Inbox size={14} className="text-gray-400" /> Backlog Inbox
          <span className="text-[10px] font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </h2>
      </div>

      <div className="px-4 py-2 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-xl px-2.5 py-1">
          <Plus size={13} className="text-gray-400" />
          <input
            type="text"
            placeholder="Add task to backlog..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && inputText.trim()) {
                await onCreateInboxTask(inputText.trim());
                setInputText("");
              }
            }}
            className="flex-1 bg-transparent border-none text-xs focus:ring-0 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-700 dark:text-gray-200 outline-none py-0.5 font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {tasks.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500 italic">
            <Inbox size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2 opacity-50" />
            <p className="text-xs font-semibold">Your backlog is clean!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="bg-white/60 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:border-violet-500/30 hover:bg-white dark:hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-200 font-semibold leading-snug flex-1">
                  {task.text}
                </span>
                {task.area && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                    style={{ background: areaColors[task.area]?.bg, color: areaColors[task.area]?.text }}
                  >
                    {task.area}
                  </span>
                )}
              </div>

              {showAreaSelectorForId === task.id ? (
                <div className="flex flex-wrap gap-1 pt-1.5 border-t border-black/5 dark:border-white/5">
                  {AREA_ORDER.map((area) => (
                    <button
                      key={area}
                      onClick={async () => {
                        await onScheduleToDate(task.id, area);
                        setShowAreaSelectorForId(null);
                      }}
                      className="text-[9px] font-bold px-2 py-1 rounded-lg capitalize border border-black/5 dark:border-white/5 hover:opacity-80 transition-colors cursor-pointer"
                      style={{ background: areaColors[area]?.bg, color: areaColors[area]?.text }}
                    >
                      {AREA_LABELS[area]}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowAreaSelectorForId(null)}
                    className="text-[9px] text-gray-400 hover:text-gray-600 px-2 py-1 cursor-pointer font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAreaSelectorForId(task.id)}
                  className="self-end text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-0.5 hover:text-violet-700 cursor-pointer"
                >
                  Schedule to {dateLabel} <ChevronRight size={10} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
