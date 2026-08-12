"use client";

import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback, Suspense, type RefObject, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Clock, CalendarRange, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { Idea, LifeArea } from "@/lib/types";
import { getToday, getTomorrow, getDatesRange, isPast, isPlanDate, addDays, addMonths, daysBetween } from "@/lib/dateUtils";
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

const TIMELINE_PRESETS = [
  { id: "focus", label: "Focus", before: "3 days", after: "2 weeks", beforeDays: 3, afterDays: 14 },
  { id: "planning", label: "Planning", before: "1 week", after: "1 month", beforeDays: 7, afterMonths: 1 },
  { id: "review", label: "Review", before: "1 month", after: "3 months", beforeMonths: 1, afterMonths: 3 },
  { id: "horizon", label: "Horizon", before: "3 months", after: "6 months", beforeMonths: 3, afterMonths: 6 },
] as const;

type TimelinePresetId = (typeof TIMELINE_PRESETS)[number]["id"];

const DEFAULT_PRESET: TimelinePresetId = "focus";
const MAX_SHOW_ALL_DAYS = 60;
const FOCUS_BACK_DAYS = 7;
const FOCUS_FORWARD_DAYS = 31;

type RenderUnit =
  | { kind: "day"; date: string }
  | { kind: "gap"; count: number };

function AnchorReadyMarker({
  date,
  onReady,
  enabled,
  children,
}: {
  date: string;
  onReady: (date: string, node: HTMLDivElement) => void;
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (enabled && ref.current) onReady(date, ref.current);
  }, [date, enabled, onReady]);

  return <div ref={ref}>{children}</div>;
}

const TIMELINE_PREFS_KEY = "timeline-prefs";

interface TimelinePrefs {
  filter: "all" | "deferred";
  preset: TimelinePresetId;
}

const DEFAULT_PREFS: TimelinePrefs = { filter: "all", preset: DEFAULT_PRESET };

function loadPrefs(): TimelinePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = JSON.parse(localStorage.getItem(TIMELINE_PREFS_KEY) ?? "{}") as Partial<TimelinePrefs>;
    const presetIds: string[] = TIMELINE_PRESETS.map((r) => r.id);
    const legacyPreset = stored.preset as string | undefined;
    const legacyPast = stored.pastRange as string | undefined;
    const legacyFuture = stored.futureRange as string | undefined;
    const migratedPreset = legacyPast === "3days" && legacyFuture === "2weeks" ? "focus"
      : legacyPast === "week" && legacyFuture === "month" ? "planning"
      : legacyPast === "month" && legacyFuture === "quarter" ? "review"
      : legacyPast === "quarter" && legacyFuture === "6months" ? "horizon"
      : undefined;
    return {
      filter: stored.filter === "deferred" ? "deferred" : "all",
      preset: presetIds.includes(legacyPreset ?? "") ? legacyPreset as TimelinePresetId : migratedPreset ?? DEFAULT_PRESET,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function RangeWindowDropdown({ preset, counts, spans, open, onToggle, onSelect, menuRef }: {
  preset: TimelinePresetId;
  counts: Record<string, number>;
  spans: Record<string, string>;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: TimelinePresetId) => void;
  menuRef: RefObject<HTMLDivElement | null>;
}) {
  const selected = TIMELINE_PRESETS.find((option) => option.id === preset) ?? TIMELINE_PRESETS[0];
  return (
    <div ref={menuRef} className="relative">
      <button type="button" onClick={onToggle} className={`toolbar-btn gap-1.5 px-2.5 ${open ? "toolbar-btn--accent" : "hover:text-gray-600 dark:hover:text-gray-300"}`}>
        <CalendarRange size={13} />
        <span>{selected.label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[250px]">
        {TIMELINE_PRESETS.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 text-[11px] rounded-lg font-semibold cursor-pointer ${
              r.id === preset
                ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20"
                : "text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            }`}
          >
            <span><span className="font-bold">{r.label}</span><span className="ml-1.5 text-gray-400 font-medium">{r.before} before · {r.after} after</span><span className="block text-[10px] text-gray-400 font-normal">{spans[r.id]}</span></span>
            <span className="text-[10px] text-gray-400 font-medium tabular-nums whitespace-nowrap">
              <span>{counts[r.id] ?? "0 before · 0 after"}</span>
            </span>
          </button>
        ))}
      </div>
      </div>}
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
  const windowMenuRef = useRef<HTMLDivElement>(null);
  const scrolledAnchorRef = useRef<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [renderedAnchor, setRenderedAnchor] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "deferred">(() => loadPrefs().filter);
  const [preset, setPreset] = useState<TimelinePresetId>(() => loadPrefs().preset);
  const [quickAddArea, setQuickAddArea] = useState<LifeArea | null>(null);
  const [anchorVisible, setAnchorVisible] = useState(true);
  const [scrollRequest, setScrollRequest] = useState(0);
  const { undoAction, clearUndo, handleUndo } = useUndoAction();

  const today = getToday();
  const tomorrow = getTomorrow();
  const anchorParam = searchParams.get("date");
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : today;
  const highlightId = searchParams.get("highlight");
  const selectedPreset = TIMELINE_PRESETS.find((r) => r.id === preset) ?? TIMELINE_PRESETS[0];
  const lookbackDays = selectedPreset.beforeMonths
    ? daysBetween(addMonths(anchor, -selectedPreset.beforeMonths), anchor)
    : selectedPreset.beforeDays ?? 3;
  const forwardDays = selectedPreset.afterMonths
    ? daysBetween(anchor, addMonths(anchor, selectedPreset.afterMonths))
    : selectedPreset.afterDays ?? 14;
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
    const maxBeforeDays = Math.max(...TIMELINE_PRESETS.map((r) => r.beforeMonths ? daysBetween(addMonths(anchor, -r.beforeMonths), anchor) : r.beforeDays ?? 0));
    const maxAfterDays = Math.max(...TIMELINE_PRESETS.map((r) => r.afterMonths ? daysBetween(anchor, addMonths(anchor, r.afterMonths)) : r.afterDays ?? 0));
    const spanDates = getDatesRange(maxBeforeDays, maxAfterDays, anchor);
    for (const date of spanDates) {
      const occs = getDayOccurrences(tasks, date, today, true);
      dateCounts[date] = effectiveFilter === "deferred" && date <= today
        ? occs.filter(isActiveOccurrence).length
        : occs.length;
    }
    const countPast = (days: number) => getDatesRange(days, 0, anchor).reduce((n, d) => (d < anchor ? n + (dateCounts[d] ?? 0) : n), 0);
    const countFuture = (days: number) => getDatesRange(0, days, anchor).reduce((n, d) => (d > anchor ? n + (dateCounts[d] ?? 0) : n), 0);
    const past: Record<string, number> = {};
    const future: Record<string, number> = {};
    for (const r of TIMELINE_PRESETS) {
      const beforeDays = r.beforeMonths ? daysBetween(addMonths(anchor, -r.beforeMonths), anchor) : r.beforeDays ?? 0;
      const afterDays = r.afterMonths ? daysBetween(anchor, addMonths(anchor, r.afterMonths)) : r.afterDays ?? 0;
      past[r.id] = countPast(beforeDays);
      future[r.id] = countFuture(afterDays);
    }
    return { past, future };
  }, [tasks, anchor, today, effectiveFilter, lookbackDays, forwardDays]);

  const rangeSpans = useMemo(() => {
    const formatSpan = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const spans: Record<string, string> = {};
    for (const r of TIMELINE_PRESETS) {
      const before = r.beforeMonths ? addMonths(anchor, -r.beforeMonths) : addDays(anchor, -(r.beforeDays ?? 0));
      const after = r.afterMonths ? addMonths(anchor, r.afterMonths) : addDays(anchor, r.afterDays ?? 0);
      spans[r.id] = `${formatSpan(before)} – ${formatSpan(after)}`;
    }
    return spans;
  }, [anchor]);

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
      localStorage.setItem(TIMELINE_PREFS_KEY, JSON.stringify({ filter, preset }));
    } catch {}
  }, [filter, preset]);

  useEffect(() => {
    if (!windowMenuOpen) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (windowMenuRef.current && !windowMenuRef.current.contains(target)) setWindowMenuOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [windowMenuOpen]);

  useEffect(() => {
    if (!windowMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWindowMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [windowMenuOpen]);

  // Auto-scroll to the selected (anchor) day once data has loaded, and on every
  // URL-driven anchor change (e.g. browser back/forward or ?date= deep links).
  useEffect(() => {
    if (loading || scrolledAnchorRef.current === anchor || renderedAnchor !== anchor || !anchorRef.current) return;
    anchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    scrolledAnchorRef.current = anchor;
  }, [anchor, loading, renderedAnchor]);

  // Re-center the selected day when the floating button is activated.
  useEffect(() => {
    if (scrollRequest === 0 || loading || !anchorRef.current) return;
    anchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollRequest(0);
  }, [scrollRequest, loading]);

  useEffect(() => {
    if (!highlightId || loading || renderedAnchor !== anchor) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryPulse = () => {
      const el = document.getElementById(`task-${highlightId}-${anchor}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        const cleanup = () => el.classList.remove("highlight-pulse");
        el.addEventListener("animationend", cleanup, { once: true });
        timer = setTimeout(cleanup, 2500);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("highlight");
        router.replace(`/timeline?${params.toString()}`, { scroll: false });
        return;
      }
      if (attempts < 30) {
        attempts += 1;
        timer = setTimeout(tryPulse, 100);
      }
    };
    timer = setTimeout(tryPulse, 120);
    return () => { if (timer) clearTimeout(timer); };
  }, [highlightId, anchor, loading, renderedAnchor, router, searchParams]);

  const handleQuickAdd = async (text: string, date: string, area: LifeArea | null) => {
    const id = await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: "planned" });
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

  const handleReorderDate = useCallback(
    (reordered: Idea[]) => { reorderTasks(reordered.map((t) => t.id)); },
    [reorderTasks],
  );

  const setAnchorParam = useCallback((d: string, taskId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", d);
    if (taskId) params.set("highlight", taskId);
    router.replace(`/timeline?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleAnchorChange = useCallback((d: string) => {
    setAnchorParam(d);
  }, [setAnchorParam]);

  const handleGoToDate = useCallback((targetDate: string, taskId: string) => {
    setAnchorParam(targetDate, taskId);
  }, [setAnchorParam]);

  const setAnchorReady = useCallback((date: string, node: HTMLDivElement) => {
    anchorRef.current = node;
    setRenderedAnchor(date);
  }, []);

  // Track anchor visibility in viewport
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAnchorVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor, loading, anchorRef]);

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
      <RangeWindowDropdown
        preset={preset}
        counts={Object.fromEntries(TIMELINE_PRESETS.map((r) => [r.id, `${rangeCounts.past[r.id] ?? 0} before · ${rangeCounts.future[r.id] ?? 0} after`]))}
        spans={rangeSpans}
        open={windowMenuOpen}
        onToggle={() => setWindowMenuOpen((v) => !v)}
        onSelect={(id) => { setPreset(id); setWindowMenuOpen(false); }}
        menuRef={windowMenuRef}
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
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <AnchorReadyMarker date={date} enabled={isAnchorDate} onReady={setAnchorReady}>
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
                      area={quickAddArea}
                      onAreaChange={setQuickAddArea}
                      onAdd={(text) => handleQuickAdd(text, date, quickAddArea)}
                    />
                  </div>
                ) : null}
                </div>
              </AnchorReadyMarker>
            </motion.section>
          );
        })
        )}
      </div>

      {/* Floating button to navigate back to the selected date */}
      {!anchorVisible && (
        <button
          onClick={() => {
            setScrollRequest((request) => request + 1);
          }}
          className="fixed bottom-6 right-6 z-50 bg-violet-600 hover:bg-violet-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center"
          aria-label={`Jump to ${formatTimelineDate(anchor)}`}
        >
          <ChevronsUpDown size={20} />
        </button>
      )}
    </AppShell>
  );
}
