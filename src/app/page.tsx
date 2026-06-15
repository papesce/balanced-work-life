"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Star,
  MoreHorizontal,
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
} from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { Idea, LifeArea } from "@/lib/types";
import { getToday, isToday, formatDate, toLocalDateString } from "@/lib/dateUtils";
import { areaColors } from "@/styles/tokens";

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
  "17:00", "18:00", "19:00", "20:00", "21:00",
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
  const { ideas, loading, createIdea, updateIdea, deleteIdea, markDone, markUndone } = useIdeas();
  const searchParams = useSearchParams();
  const [activeDate, setActiveDate] = useState<string>(() => searchParams.get("date") ?? getToday());

  // Sync when URL param changes (e.g. navigating from Timeline)
  useEffect(() => {
    const d = searchParams.get("date");
    if (d) setActiveDate(d);
  }, [searchParams]);
  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(null);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [targets, setTargets] = useState<Record<LifeArea, number>>(DEFAULT_TARGETS);
  const [showAreaSelectorForId, setShowAreaSelectorForId] = useState<string | null>(null);
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

  const balanceState = useMemo(() => {
    const total = pendingOnDate.length;
    return AREA_ORDER.map((area) => {
      const count = areaTaskCounts[area].pending;
      const actual = total > 0 ? (count / total) * 100 : 0;
      const target = targets[area];
      const diff = actual - target;
      const status: "ok" | "high" | "low" =
        target === 0 ? "ok" : diff > 12 ? "high" : actual === 0 && target > 0 ? "low" : "ok";
      return { area, count, actual, target, status };
    });
  }, [pendingOnDate, areaTaskCounts, targets]);

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

  const isViewingToday = activeDate === today;

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
      {/* Balance bar */}
      <BalanceBar
        balanceState={balanceState}
        totalPending={pendingOnDate.length}
        totalDone={doneOnDate.length}
        isViewingToday={isViewingToday}
      />

      <div className="flex gap-4 mt-4">
        {/* Left rail */}
        <AreaRail
          areaTaskCounts={areaTaskCounts}
          selectedArea={selectedArea}
          onSelectArea={(area) => setSelectedArea(selectedArea === area ? null : area)}
          inboxCount={inboxTasks.length}
          onOpenBacklog={() => setBacklogOpen(true)}
          showSchedule={showSchedule}
          onToggleSchedule={() => setShowSchedule((v) => !v)}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Schedule grid */}
          {showSchedule && (
            <ScheduleGrid
              activeDate={activeDate}
              allTasks={[...pendingOnDate, ...doneOnDate]}
              onUpdateTask={updateIdea}
              onCreateTask={handleCreateScheduledTask}
            />
          )}

          {/* Task groups */}
          {visibleAreas.map((area) => {
            const pending = pendingOnDate.filter((t) => (t.area ?? "life") === area);
            const done = doneOnDate.filter((t) => (t.area ?? "life") === area);
            if (pending.length === 0 && done.length === 0 && selectedArea !== area) return null;

            return (
              <AreaTaskGroup
                key={area}
                area={area}
                pendingTasks={pending}
                doneTasks={done}
                onDone={markDone}
                onUndone={markUndone}
                onUpdate={updateIdea}
                onDelete={deleteIdea}
                onAddTask={handleAddToArea}
              />
            );
          })}

          {pendingOnDate.length === 0 && doneOnDate.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-sm font-medium mb-1">
                No tasks planned for {formatDayLabel(activeDate, today).toLowerCase()}
              </p>
              <p className="text-xs">Add tasks to areas above, or pull from your backlog →</p>
            </div>
          )}
        </div>
      </div>

      {/* Backlog drawer */}
      {backlogOpen && (
        <BacklogDrawer
          tasks={inboxTasks}
          activeDate={activeDate}
          today={today}
          showAreaSelectorForId={showAreaSelectorForId}
          onSetAreaSelector={setShowAreaSelectorForId}
          onScheduleToDate={async (id, area) => {
            await updateIdea(id, { scheduled_date: activeDate, area, status: "scheduled" });
            setShowAreaSelectorForId(null);
          }}
          onCreateInboxTask={async (text) => {
            await createIdea(text, null, "top", { type: "task", status: "inbox" });
          }}
          onClose={() => setBacklogOpen(false)}
        />
      )}
    </AppShell>
  );
}

// ─── Date Nav ────────────────────────────────────────────────────────────────

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
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <CalendarDays size={13} className="text-gray-400" />
          {label}
        </button>
      )}

      <button
        onClick={() => onChangeDate(offsetDate(activeDate, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
      >
        <ChevronRight size={15} />
      </button>

      {!isToday && (
        <button
          onClick={onGoToday}
          className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ─── Balance Bar ─────────────────────────────────────────────────────────────

function BalanceBar({
  balanceState,
  totalPending,
  totalDone,
  isViewingToday,
}: {
  balanceState: { area: LifeArea; count: number; actual: number; target: number; status: string }[];
  totalPending: number;
  totalDone: number;
  isViewingToday: boolean;
}) {
  const lowAreas = balanceState.filter((b) => b.status === "low").map((b) => AREA_LABELS[b.area]);
  const allGood = lowAreas.length === 0 && totalPending > 0;

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        {balanceState.map(({ area, status, count }) => (
          <div
            key={area}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              backgroundColor: areaColors[area]?.dot,
              opacity: count === 0 ? 0.2 : 1,
              transform: status === "low" ? "scale(1.4)" : "scale(1)",
            }}
            title={`${AREA_LABELS[area]}: ${count} tasks`}
          />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {totalPending === 0 && totalDone === 0 ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {isViewingToday ? "Plan your day below" : "No tasks planned for this day"}
          </span>
        ) : allGood ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Balanced — {totalPending} pending, {totalDone} done
          </span>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {totalPending} pending · {totalDone} done
            {lowAreas.length > 0 && (
              <> · <span className="font-semibold">{lowAreas.join(", ")} need attention</span></>
            )}
          </span>
        )}
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500 font-medium tabular-nums flex-shrink-0">
        {totalDone}/{totalPending + totalDone}
      </div>
    </div>
  );
}

// ─── Area Rail ───────────────────────────────────────────────────────────────

function AreaRail({
  areaTaskCounts,
  selectedArea,
  onSelectArea,
  inboxCount,
  onOpenBacklog,
  showSchedule,
  onToggleSchedule,
}: {
  areaTaskCounts: Record<LifeArea, { pending: number; done: number }>;
  selectedArea: LifeArea | null;
  onSelectArea: (area: LifeArea) => void;
  inboxCount: number;
  onOpenBacklog: () => void;
  showSchedule: boolean;
  onToggleSchedule: () => void;
}) {
  return (
    <div className="w-[140px] flex-shrink-0 space-y-1">
      <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-2">
        Areas
      </p>

      {AREA_ORDER.map((area) => {
        const { pending, done } = areaTaskCounts[area];
        const total = pending + done;
        const Icon = AREA_ICONS[area];
        const isSelected = selectedArea === area;
        const color = areaColors[area]?.dot;

        return (
          <button
            key={area}
            onClick={() => onSelectArea(area)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${
              isSelected
                ? "bg-white/80 dark:bg-white/10 shadow-sm border border-white/60 dark:border-white/10"
                : "hover:bg-white/40 dark:hover:bg-white/5"
            }`}
          >
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: areaColors[area]?.bg }}
            >
              <Icon size={11} style={{ color }} />
            </div>
            <span
              className={`text-[11px] font-semibold truncate ${
                isSelected ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {AREA_LABELS[area]}
            </span>
            {total > 0 && (
              <span className="ml-auto text-[9px] font-bold tabular-nums flex-shrink-0">
                {pending > 0 ? (
                  <span className="text-gray-400 dark:text-gray-500">{pending}</span>
                ) : (
                  <span className="text-emerald-500">✓</span>
                )}
              </span>
            )}
          </button>
        );
      })}

      <div className="pt-3 border-t border-black/5 dark:border-white/5 mt-1 space-y-1">
        <button
          onClick={onOpenBacklog}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-white/40 dark:hover:bg-white/5 transition-all"
        >
          <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-white/5">
            <Inbox size={11} className="text-gray-400 dark:text-gray-500" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Backlog</span>
          {inboxCount > 0 && (
            <span className="ml-auto text-[9px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0">
              {inboxCount}
            </span>
          )}
        </button>

        <button
          onClick={onToggleSchedule}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${
            showSchedule
              ? "bg-white/80 dark:bg-white/10 shadow-sm border border-white/60 dark:border-white/10"
              : "hover:bg-white/40 dark:hover:bg-white/5"
          }`}
        >
          <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-white/5">
            <Clock size={11} className="text-gray-400 dark:text-gray-500" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Schedule</span>
        </button>
      </div>
    </div>
  );
}

// ─── Schedule Grid ────────────────────────────────────────────────────────────

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
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 dark:border-white/5">
        <Clock size={13} className="text-gray-400" />
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Schedule</span>
      </div>

      <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {SCHEDULE_HOURS.map((hour) => {
          const hourKey = hour.split(":")[0];
          const tasksInSlot = scheduledTasks.filter(
            (t) => t.scheduled_time?.split(":")[0] === hourKey
          );
          const isActive = activeInputHour === hour;

          return (
            <div key={hour} className="flex items-start gap-3 px-4 py-2 group">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-9 pt-0.5 tabular-nums flex-shrink-0">
                {formatTime(hour)}
              </span>

              <div className="flex-1 space-y-1 min-w-0">
                {tasksInSlot.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: areaColors[task.area ?? "life"]?.dot }}
                    />
                    <span
                      className={`flex-1 truncate ${
                        task.done_at
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {task.text}
                    </span>
                    {task.duration_minutes && (
                      <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">
                        {task.duration_minutes}m
                      </span>
                    )}
                    <button
                      onClick={() => onUpdateTask(task.id, { scheduled_time: null })}
                      className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {isActive ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Task description..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCreate(hour);
                        if (e.key === "Escape") setActiveInputHour(null);
                      }}
                      className="flex-1 bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-800 dark:text-gray-200 min-w-0"
                      autoFocus
                    />
                    <select
                      value={inputArea}
                      onChange={(e) => setInputArea(e.target.value as LifeArea)}
                      className="bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      {AREA_ORDER.map((a) => (
                        <option key={a} value={a}>{AREA_LABELS[a]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => void handleCreate(hour)}
                      className="text-[11px] bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 font-semibold flex-shrink-0"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setActiveInputHour(null)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveInputHour(hour); setInputText(""); }}
                    className="w-full text-left text-[10px] text-gray-300 dark:text-gray-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100 py-0.5"
                  >
                    + {formatTime(hour)}
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

// ─── Area Task Group ──────────────────────────────────────────────────────────

function AreaTaskGroup({
  area,
  pendingTasks,
  doneTasks,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onAddTask,
}: {
  area: LifeArea;
  pendingTasks: Idea[];
  doneTasks: Idea[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onAddTask: (text: string, area: LifeArea) => Promise<void>;
}) {
  const Icon = AREA_ICONS[area];
  const color = areaColors[area]?.dot;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 dark:border-white/5"
        style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" }}
      >
        <div
          className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: areaColors[area]?.bg }}
        >
          <Icon size={11} style={{ color }} />
        </div>
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{AREA_LABELS[area]}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
          {pendingTasks.length} pending{doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ""}
        </span>
      </div>

      <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {pendingTasks.map((task) => (
          <TaskRow key={task.id} task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {doneTasks.map((task) => (
          <TaskRow key={task.id} task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">No tasks for this day</div>
        )}
      </div>

      <div className="px-4 pb-2 pt-1">
        <input
          type="text"
          placeholder={`+ Add to ${AREA_LABELS[area]}...`}
          className="w-full bg-transparent border-none text-xs py-1.5 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic text-gray-700 dark:text-gray-300 outline-none"
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

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
}) {
  const isCompleted = !!task.done_at;
  const [showMenu, setShowMenu] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors group">
      <button
        onClick={() => (isCompleted ? onUndone(task.id) : onDone(task.id))}
        className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          borderColor: isCompleted ? "#7c3aed" : "var(--text-subtle, #9ca3af)",
          background: isCompleted ? "#7c3aed" : "transparent",
        }}
      >
        {isCompleted && <Check size={8} strokeWidth={4} className="text-white" />}
      </button>

      <span
        className={`flex-1 text-[13px] min-w-0 truncate ${
          isCompleted ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
        }`}
        style={{ fontWeight: isCompleted ? 400 : 450 }}
      >
        {task.text}
      </span>

      {/* Duration badge — click to edit */}
      {editingDuration ? (
        <input
          type="number"
          min="5"
          max="480"
          step="5"
          defaultValue={task.duration_minutes ?? ""}
          placeholder="min"
          autoFocus
          className="w-16 text-[11px] bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 tabular-nums"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = parseInt(e.currentTarget.value);
              onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
              setEditingDuration(false);
            }
            if (e.key === "Escape") setEditingDuration(false);
          }}
          onBlur={(e) => {
            const val = parseInt(e.currentTarget.value);
            onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
            setEditingDuration(false);
          }}
        />
      ) : (
        <button
          onClick={() => setEditingDuration(true)}
          className={`text-[10px] tabular-nums flex-shrink-0 transition-colors rounded px-1 py-0.5 ${
            task.duration_minutes
              ? "text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5"
              : "text-gray-200 dark:text-gray-700 opacity-0 group-hover:opacity-100 hover:text-gray-400"
          }`}
          title="Set duration"
        >
          {task.duration_minutes ? `${task.duration_minutes}m` : <Clock size={11} />}
        </button>
      )}

      {task.scheduled_time && (
        <span className="text-[10px] text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 px-1.5 py-0.5 rounded flex-shrink-0 font-semibold tabular-nums">
          {formatTime(task.scheduled_time)}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
          className={task.is_priority ? "text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-400"}
        >
          <Star size={12} className={task.is_priority ? "fill-amber-400" : ""} />
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)} className="text-gray-300 dark:text-gray-600 hover:text-gray-500">
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 glass-card-strong rounded-lg py-1 min-w-[150px] shadow-lg">
              <button
                onClick={() => { onUpdate(task.id, { scheduled_date: null, status: "inbox" }); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                Move to Backlog
              </button>
              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
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

// ─── Backlog Drawer ───────────────────────────────────────────────────────────

function BacklogDrawer({
  tasks,
  activeDate,
  today,
  showAreaSelectorForId,
  onSetAreaSelector,
  onScheduleToDate,
  onCreateInboxTask,
  onClose,
}: {
  tasks: Idea[];
  activeDate: string;
  today: string;
  showAreaSelectorForId: string | null;
  onSetAreaSelector: (id: string | null) => void;
  onScheduleToDate: (id: string, area: LifeArea) => Promise<void>;
  onCreateInboxTask: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [inputText, setInputText] = useState("");
  const dateLabel = formatDayLabel(activeDate, today);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[340px] z-50 glass-card-strong border-l border-white/20 dark:border-white/5 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Inbox size={15} /> Backlog
            <span className="text-[10px] font-semibold bg-black/5 dark:bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
            Scheduling to: <span className="font-semibold text-violet-600 dark:text-violet-400">{dateLabel}</span>
          </p>
          <input
            type="text"
            placeholder="+ Add to backlog..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && inputText.trim()) {
                await onCreateInboxTask(inputText.trim());
                setInputText("");
              }
            }}
            className="w-full bg-transparent border-none text-xs py-1 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic text-gray-700 dark:text-gray-200 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 p-5">
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-12">Backlog is empty</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] text-gray-700 dark:text-gray-200 font-medium leading-snug flex-1">
                    {task.text}
                  </span>
                  {task.area && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                      style={{ background: areaColors[task.area]?.bg, color: areaColors[task.area]?.text }}
                    >
                      {task.area}
                    </span>
                  )}
                </div>

                {showAreaSelectorForId === task.id ? (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-black/5 dark:border-white/5">
                    {AREA_ORDER.map((area) => (
                      <button
                        key={area}
                        onClick={() => onScheduleToDate(task.id, area)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-md capitalize border border-black/5 dark:border-white/5 transition-colors"
                        style={{ background: areaColors[area]?.bg, color: areaColors[area]?.text }}
                      >
                        {AREA_LABELS[area]}
                      </button>
                    ))}
                    <button onClick={() => onSetAreaSelector(null)} className="text-[10px] text-gray-400 px-2 py-1">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onSetAreaSelector(task.id)}
                    className="self-end text-[11px] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-0.5 hover:text-violet-700"
                  >
                    Schedule to {dateLabel} <ChevronRight size={11} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
