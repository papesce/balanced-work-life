"use client";

import { useMemo, useRef, useEffect, useState, useCallback, Suspense, type ReactNode, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Clock, CalendarRange, ChevronDown } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { Idea } from "@/lib/types";
import { getToday, getTomorrow, getDatesRange, isPast, isPlanDate } from "@/lib/dateUtils";
import { computeReschedulePatch, getDayOccurrences, isActiveOccurrence, DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { useUndoAction } from "@/lib/tasks/undo";
import { DayTaskList } from "@/components/timeline/DayTaskList";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { UndoBar } from "@/components/shared/UndoBar";
import { DateNav } from "@/components/planner/DateNav";
import { formatTimelineDate, getTimelineKicker } from "@/components/timeline/timelineUtils";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) =>
    ({
      opacity: 1,
      y: 0,
      transition: { delay: Math.min(i, 5) * 0.06, duration: 0.35, ease: "easeOut" },
    }) as const,
};

const PAST_RANGES = [
  { id: "3days", label: "Past 3 Days", days: 3 },
  { id: "week", label: "Last Week", days: 7 },
  { id: "month", label: "Last Month", days: 31 },
  { id: "quarter", label: "Last 3 Months", days: 92 },
  { id: "6months", label: "Last 6 Months", days: 183 },
  { id: "year", label: "Last Year", days: 366 },
] as const;

const FUTURE_RANGES = [
  { id: "3days", label: "Next 3 Days", days: 3 },
  { id: "week", label: "Next Week", days: 7 },
  { id: "2weeks", label: "Next 14 Days", days: 14 },
  { id: "month", label: "Next Month", days: 31 },
  { id: "quarter", label: "Next 3 Months", days: 92 },
] as const;

type PastRangeId = (typeof PAST_RANGES)[number]["id"];
type FutureRangeId = (typeof FUTURE_RANGES)[number]["id"];

const MAX_LOOKBACK_DAYS = PAST_RANGES[PAST_RANGES.length - 1].days;
const MAX_FORWARD_DAYS = FUTURE_RANGES[FUTURE_RANGES.length - 1].days;
const MAX_SHOW_ALL_DAYS = 60;
const FOCUS_BACK_DAYS = 7;
const FOCUS_FORWARD_DAYS = 31;

type RenderUnit =
  | { kind: "day"; date: string }
  | { kind: "gap"; count: number };

const TIMELINE_PREFS_KEY = "timeline-prefs";

interface TimelinePrefs {
  filter: "all" | "deferred";
  pastRange: PastRangeId;
  futureRange: FutureRangeId;
}

const DEFAULT_PREFS: TimelinePrefs = { filter: "all", pastRange: "3days", futureRange: "2weeks" };

function loadPrefs(): TimelinePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = JSON.parse(localStorage.getItem(TIMELINE_PREFS_KEY) ?? "{}") as Partial<TimelinePrefs>;
    const pastIds: string[] = PAST_RANGES.map((r) => r.id);
    const futureIds: string[] = FUTURE_RANGES.map((r) => r.id);
    return {
      filter: stored.filter === "deferred" ? "deferred" : "all",
      pastRange: pastIds.includes(stored.pastRange as string) ? (stored.pastRange as PastRangeId) : DEFAULT_PREFS.pastRange,
      futureRange: futureIds.includes(stored.futureRange as string) ? (stored.futureRange as FutureRangeId) : DEFAULT_PREFS.futureRange,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function RangeDropdown({
  options,
  selectedId,
  counts,
  open,
  onToggle,
  onSelect,
  menuRef,
  icon,
}: {
  options: readonly { id: string; label: string; days: number }[];
  selectedId: string;
  counts: Record<string, number>;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  icon?: ReactNode;
}) {
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`toolbar-btn gap-1.5 px-2.5 ${
          open
            ? "toolbar-btn--accent"
            : "hover:text-gray-600 dark:hover:text-gray-300"
        }`}
      >
        {icon}
        <span>{selected.label} ({counts[selected.id] ?? 0})</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[160px] space-y-0.5">
          {options.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 text-[11px] rounded-lg font-semibold cursor-pointer ${
                r.id === selectedId
                  ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20"
                  : "text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
            >
              <span>{r.label}</span>
              <span className="text-gray-400">({counts[r.id] ?? 0})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense>
      <TimelineInner />
    </Suspense>
  );
}

function TimelineInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ideas, loading, createIdea, markDone, markUndone, updateIdea, reorderTasks, smartSortTasks } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const anchorRef = useRef<HTMLElement>(null);
  const hasAutoScrolled = useRef(false);
  const pastMenuRef = useRef<HTMLDivElement>(null);
  const futureMenuRef = useRef<HTMLDivElement>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [openMenu, setOpenMenu] = useState<"past" | "future" | null>(null);
  const [filter, setFilter] = useState<"all" | "deferred">(() => loadPrefs().filter);
  const [pastRange, setPastRange] = useState<PastRangeId>(() => loadPrefs().pastRange);
  const [futureRange, setFutureRange] = useState<FutureRangeId>(() => loadPrefs().futureRange);
  const { undoAction, clearUndo, handleUndo } = useUndoAction();

  const today = getToday();
  const tomorrow = getTomorrow();
  const anchorParam = searchParams.get("date");
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : today;
  const lookbackDays = PAST_RANGES.find((r) => r.id === pastRange)?.days ?? 3;
  const forwardDays = FUTURE_RANGES.find((r) => r.id === futureRange)?.days ?? 14;
  const extendedRange = lookbackDays !== 3 || forwardDays !== 14;
  const dates = useMemo(
    () => getDatesRange(lookbackDays, forwardDays, anchor),
    [lookbackDays, forwardDays, anchor],
  );
  const hasRevisitDates = dates.some((d) => d <= today);
  const effectiveFilter = hasRevisitDates ? filter : "all";
  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const occurrencesByDate = useMemo(() => {
    const map: Record<string, DayOccurrence[]> = {};
    for (const date of dates) {
      const occurrences = getDayOccurrences(tasks, date, today, true);
      map[date] = effectiveFilter === "deferred" && date <= today
        ? occurrences.filter(isActiveOccurrence)
        : occurrences;
    }
    return map;
  }, [tasks, dates, today, effectiveFilter]);

  const rangeCounts = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    const spanDates = getDatesRange(MAX_LOOKBACK_DAYS, MAX_FORWARD_DAYS, anchor);
    for (const date of spanDates) {
      dateCounts[date] = getDayOccurrences(tasks, date, today, true).length;
    }
    const countPast = (days: number) => getDatesRange(days, 0, anchor).reduce((n, d) => (d < anchor ? n + (dateCounts[d] ?? 0) : n), 0);
    const countFuture = (days: number) => getDatesRange(0, days, anchor).reduce((n, d) => (d > anchor ? n + (dateCounts[d] ?? 0) : n), 0);
    const past: Record<string, number> = {};
    const future: Record<string, number> = {};
    for (const r of PAST_RANGES) past[r.id] = countPast(r.days);
    for (const r of FUTURE_RANGES) future[r.id] = countFuture(r.days);
    return { past, future };
  }, [tasks, anchor, today]);

  const renderPlan = useMemo((): RenderUnit[] => {
    if (!extendedRange || dates.length <= MAX_SHOW_ALL_DAYS) {
      return dates.map((d) => ({ kind: "day", date: d }));
    }
    const anchorIndex = dates.indexOf(anchor);
    const plan: RenderUnit[] = [];
    let gapCount = 0;
    const flushGap = () => {
      if (gapCount > 0) {
        plan.push({ kind: "gap", count: gapCount });
        gapCount = 0;
      }
    };
    dates.forEach((date, i) => {
      const hasOccurrences = (occurrencesByDate[date]?.length ?? 0) > 0;
      const withinFocus =
        anchorIndex >= 0 && i >= anchorIndex - FOCUS_BACK_DAYS && i <= anchorIndex + FOCUS_FORWARD_DAYS;
      if (hasOccurrences || withinFocus) {
        flushGap();
        plan.push({ kind: "day", date });
      } else {
        gapCount += 1;
      }
    });
    flushGap();
    return plan;
  }, [dates, occurrencesByDate, extendedRange, anchor]);

  const noDeferredActivity =
    effectiveFilter === "deferred" &&
    extendedRange &&
    !dates.some((d) => (occurrencesByDate[d]?.length ?? 0) > 0);

  const handleFilterChange = (id: "all" | "deferred") => {
    setFilter(id);
  };

  useEffect(() => {
    try {
      localStorage.setItem(TIMELINE_PREFS_KEY, JSON.stringify({ filter, pastRange, futureRange }));
    } catch {}
  }, [filter, pastRange, futureRange]);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (openMenu === "past" && pastMenuRef.current && !pastMenuRef.current.contains(target)) setOpenMenu(null);
      if (openMenu === "future" && futureMenuRef.current && !futureMenuRef.current.contains(target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openMenu]);

  useEffect(() => {
    if (loading || hasAutoScrolled.current) return;
    const timer = setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      hasAutoScrolled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleQuickAdd = async (text: string, date: string) => {
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: "planned" });
  };

  const handleReschedule = useCallback(async (id: string, action: RescheduleAction) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const patch = computeReschedulePatch(idea, action);
    await updateIdea(id, patch);
  }, [ideas, updateIdea]);

  const handleReorderDate = useCallback(
    (reordered: Idea[]) => { reorderTasks(reordered.map((t) => t.id)); },
    [reorderTasks],
  );

  const pulseTask = useCallback((taskId: string, date: string) => {
    const el = document.getElementById(`task-${taskId}-${date}`);
    if (!el) return;
    el.classList.add("highlight-pulse");
    const cleanup = () => el.classList.remove("highlight-pulse");
    el.addEventListener("animationend", cleanup, { once: true });
    setTimeout(cleanup, 2500);
  }, []);

  const recenterOn = useCallback((d: string, onDone?: () => void) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        onDone?.();
      });
    });
  }, []);

  const setAnchorParam = useCallback((d: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", d);
    router.replace(`/timeline?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleAnchorChange = useCallback((d: string) => {
    setAnchorParam(d);
    recenterOn(d);
  }, [setAnchorParam, recenterOn]);

  const handleGoToDate = useCallback((targetDate: string, taskId: string) => {
    setAnchorParam(targetDate);
    recenterOn(targetDate, () => pulseTask(taskId, targetDate));
  }, [setAnchorParam, recenterOn, pulseTask]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const headerActions = (
    <DateNav
      activeDate={anchor}
      today={today}
      showDateInput={showDateInput}
      onShowDateInput={setShowDateInput}
      onChangeDate={handleAnchorChange}
    />
  );

  const headerStartActions = (
    <>
      <div className="flex gap-1 h-8 p-0.5 bg-white/70 dark:bg-gray-900/60 border border-black/5 dark:border-white/5 rounded-lg shadow-sm">
        {[
          { id: "all" as const, label: "All" },
          { id: "deferred" as const, label: "Deferred", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.id;
          const isDisabled = tab.id === "deferred" && !hasRevisitDates;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isDisabled) return;
                handleFilterChange(tab.id);
              }}
              disabled={isDisabled}
              title={isDisabled ? "Deferred applies to past dates" : undefined}
              className={`flex items-center gap-1.5 px-2.5 rounded-md text-xs font-semibold transition-all ${
                isDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              } ${
                isActive
                  ? "bg-white dark:bg-gray-800 shadow-sm text-violet-600 dark:text-violet-400 font-bold"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {Icon && <Icon size={13} />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <RangeDropdown
        options={PAST_RANGES}
        selectedId={pastRange}
        counts={rangeCounts.past}
        open={openMenu === "past"}
        onToggle={() => setOpenMenu((v) => (v === "past" ? null : "past"))}
        onSelect={(id) => {
          setPastRange(id as PastRangeId);
          setOpenMenu(null);
        }}
        menuRef={pastMenuRef}
        icon={<Clock size={13} />}
      />
      <RangeDropdown
        options={FUTURE_RANGES}
        selectedId={futureRange}
        counts={rangeCounts.future}
        open={openMenu === "future"}
        onToggle={() => setOpenMenu((v) => (v === "future" ? null : "future"))}
        onSelect={(id) => {
          setFutureRange(id as FutureRangeId);
          setOpenMenu(null);
        }}
        menuRef={futureMenuRef}
        icon={<CalendarRange size={13} />}
      />
    </>
  );

  return (
    <AppShell title="Timeline" headerActions={headerActions} headerStartActions={headerStartActions}>
      <div className="space-y-4 pb-24">
        <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

        {noDeferredActivity ? (
          <div className="glass-card rounded-2xl text-center py-20 text-gray-400 dark:text-gray-500 border border-dashed border-black/5 dark:border-white/5">
            <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 opacity-60" />
            <p className="text-sm font-semibold mb-1">No deferred tasks</p>
            <p className="text-xs">No tasks found in the selected range.</p>
          </div>
        ) : (
          renderPlan.map((unit, index) => {
          if (unit.kind === "gap") {
            return (
              <div key={`gap-${index}`} className="flex items-center justify-center py-1">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-300 dark:text-gray-600">
                  <div className="h-px w-8 bg-black/10 dark:bg-white/10" />
                  +{unit.count} empty {unit.count === 1 ? "day" : "days"}
                  <div className="h-px w-8 bg-black/10 dark:bg-white/10" />
                </div>
              </div>
            );
          }
          const date = unit.date;
          const dayOccurrences = occurrencesByDate[date] ?? [];
          const dayTasks = dayOccurrences.filter((o) => !o.isHistorical).map((o) => o.task);
          const isAnchorDate = date === anchor;
          const isTodayDate = date === today;
          const dateLabel = formatTimelineDate(date);
          const timelineKicker = getTimelineKicker(date, today, tomorrow);
          const unresolvedCount = dayOccurrences.filter((o) => !o.isHistorical && o.task.status !== "completed" && o.task.status !== "cancelled" && isPast(date)).length;

          return (
            <motion.section
              key={date}
              id={`day-${date}`}
              ref={isAnchorDate ? anchorRef : null}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div id={isAnchorDate ? "anchor-card" : undefined} className={`rounded-[20px] transition-all ${
                isAnchorDate ? "glass-card-anchor" : isTodayDate ? "glass-card-today" : "glass-card"
              }`}>
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                        isAnchorDate ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
                      }`}>
                        {timelineKicker}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-[22px] font-bold text-gray-900 dark:text-gray-100 leading-tight">
                          {dateLabel}
                        </span>
                        {isTodayDate && (
                          <span className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            Today
                          </span>
                        )}
                      </span>
                    </div>
                    {unresolvedCount > 0 && (
                      <span className="bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                        {unresolvedCount} unresolved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBalanceBar tasks={dayTasks} getTagsForIdea={taskTagsHook.getTagsForIdea} date={date} />
                    {dayTasks.length > 0 && (
                      <button
                        onClick={() => smartSortTasks(dayTasks)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 px-2 py-1 rounded-lg transition-all"
                        title="Sort tasks by priority score (effort × impact × urgency)"
                      >
                        <Sparkles size={12} />
                        <span className="hidden sm:inline">Smart Sort</span>
                      </button>
                    )}
                    <button onClick={() => router.push(`/?date=${date}`)} className="focus-button">
                      Plan
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-2">
                  {dayOccurrences.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">
                      {effectiveFilter === "deferred" ? "No deferred tasks this day" : "No tasks planned"}
                    </p>
                  ) : (
                    <DayTaskList
                      occurrences={dayOccurrences}
                      onReorder={handleReorderDate}
                      onDone={markDone}
                      onUndone={markUndone}
                      onUpdate={updateIdea}
                      onReschedule={handleReschedule}
                      today={today}
                      onGoToDate={handleGoToDate}
                      allTags={tagsHook.tags}
                      getTagsForIdea={taskTagsHook.getTagsForIdea}
                      onAddTag={taskTagsHook.addTagToTask}
                      onRemoveTag={taskTagsHook.removeTagFromTask}
                      onCreateTag={tagsHook.createTag}
                    />
                  )}
                </div>

                {effectiveFilter === "all" || isPlanDate(date) ? (
                  <div className="px-5 pb-4 pt-1">
                    <QuickAddInput
                      placeholder={`+ Add task for ${isTodayDate ? "today" : dateLabel}...`}
                      onAdd={(text) => handleQuickAdd(text, date)}
                    />
                  </div>
                ) : null}
              </div>
            </motion.section>
          );
        })
        )}
      </div>
    </AppShell>
  );
}
