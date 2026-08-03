"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Clock, ChevronDown } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { Idea } from "@/lib/types";
import { getToday, getTomorrow, getDatesRange, isPast } from "@/lib/dateUtils";
import { computeReschedulePatch, computeCancelPatch, getDayOccurrences, isActiveOccurrence, DayOccurrence, RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { useUndoAction } from "@/lib/tasks/undo";
import { DayTaskList } from "@/components/timeline/DayTaskList";
import { FloatingAddButton } from "@/components/timeline/FloatingAddButton";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { UndoBar } from "@/components/shared/UndoBar";
import { JumpToTodayButton } from "@/components/shared/JumpToTodayButton";
import { formatTimelineDate, getTimelineKicker } from "@/components/timeline/timelineUtils";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) =>
    ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
    }) as const,
};

const DEFERRED_RANGES = [
  { id: "default", label: "Past 3 Days", days: 3 },
  { id: "week", label: "Last Week", days: 7 },
  { id: "month", label: "Last Month", days: 31 },
  { id: "quarter", label: "Last 3 Months", days: 92 },
  { id: "6months", label: "Last 6 Months", days: 183 },
  { id: "year", label: "Last Year", days: 366 },
] as const;

type DeferredRangeId = (typeof DEFERRED_RANGES)[number]["id"];

export default function TimelinePage() {
  const router = useRouter();
  const { ideas, loading, createIdea, markDone, markUndone, updateIdea, reorderTasks, smartSortTasks } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const todayRef = useRef<HTMLElement>(null);
  const hasAutoScrolled = useRef(false);
  const rangeMenuRef = useRef<HTMLDivElement>(null);
  const [todayInView, setTodayInView] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "deferred">("all");
  const [deferredRange, setDeferredRange] = useState<DeferredRangeId>("default");
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

  const today = getToday();
  const tomorrow = getTomorrow();
  const extendedRange = filter === "deferred" && deferredRange !== "default";
  const lookbackDays = extendedRange
    ? DEFERRED_RANGES.find((r) => r.id === deferredRange)?.days ?? 3
    : 3;
  const dates = useMemo(
    () => getDatesRange(lookbackDays, filter === "deferred" ? 0 : 14),
    [lookbackDays, filter],
  );
  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const occurrencesByDate = useMemo(() => {
    const map: Record<string, DayOccurrence[]> = {};
    for (const date of dates) {
      const occurrences = getDayOccurrences(tasks, date, today, true);
      map[date] = filter === "deferred"
        ? occurrences.filter(
            (occurrence) =>
              (occurrence.isHistorical || occurrence.date < today) &&
              isActiveOccurrence(occurrence),
          )
        : occurrences;
    }
    return map;
  }, [tasks, dates, today, filter]);

  const visibleDates = useMemo(
    () =>
      extendedRange
        ? dates.filter((d) => d === today || (occurrencesByDate[d]?.length ?? 0) > 0)
        : dates,
    [dates, occurrencesByDate, extendedRange, today],
  );

  const noDeferredActivity = extendedRange && !visibleDates.some((d) => (occurrencesByDate[d]?.length ?? 0) > 0);

  const handleFilterChange = (id: "all" | "deferred") => {
    setFilter(id);
    if (id === "all") {
      setDeferredRange("default");
      setRangeMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!rangeMenuOpen) return;
    const handler = (e: PointerEvent) => {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(e.target as Node)) {
        setRangeMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [rangeMenuOpen]);

  useEffect(() => {
    if (!loading && !hasAutoScrolled.current) {
      const timer = setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        hasAutoScrolled.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    const el = todayRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTodayInView(entry.isIntersecting),
      { rootMargin: "-30% 0px -30% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, filter]);

  const handleQuickAdd = async (text: string, date: string) => {
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: "planned" });
  };

  const handleReschedule = useCallback(async (id: string, action: RescheduleAction) => {
    const idea = ideas.find((i) => i.id === id);
    if (!idea) return;
    const patch = computeReschedulePatch(idea, action);
    await updateIdea(id, patch);
  }, [ideas, updateIdea]);

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

  const handleFabAdd = async (text: string, date: string | null) => {
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: date ? "planned" : "inbox" });
    setFabOpen(false);
  };

  const handleReorderDate = useCallback(
    (date: string) => (reordered: Idea[]) => { reorderTasks(reordered.map((t) => t.id)); },
    [reorderTasks],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const currentRangeLabel = DEFERRED_RANGES.find((r) => r.id === deferredRange)?.label ?? "Past 3 Days";

  const headerActions = (
    <>
      <div className="flex gap-1 p-1 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl">
        {[
          { id: "all" as const, label: "All" },
          { id: "deferred" as const, label: "Deferred", icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
      {filter === "deferred" && (
        <div ref={rangeMenuRef} className="relative">
          <button
            onClick={() => setRangeMenuOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 ${
              rangeMenuOpen
                ? "text-violet-600 dark:text-violet-400"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <Clock size={13} />
            <span>{currentRangeLabel}</span>
            <ChevronDown size={12} className={`transition-transform ${rangeMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {rangeMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[160px] space-y-0.5">
              {DEFERRED_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setDeferredRange(r.id);
                    setRangeMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-[11px] rounded-lg font-semibold cursor-pointer ${
                    r.id === deferredRange
                      ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20"
                      : "text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <JumpToTodayButton
        onClick={() => todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
        isToday={todayInView}
      />
    </>
  );

  return (
    <AppShell title="Timeline" headerActions={headerActions}>
      <div className="space-y-4 pb-24">
        <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />

        {noDeferredActivity ? (
          <div className="glass-card rounded-2xl text-center py-20 text-gray-400 dark:text-gray-500 border border-dashed border-black/5 dark:border-white/5">
            <Clock size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3 opacity-60" />
            <p className="text-sm font-semibold mb-1">No deferred tasks</p>
            <p className="text-xs">No tasks found in the {currentRangeLabel.toLowerCase()}.</p>
          </div>
        ) : (
          visibleDates.map((date, index) => {
          const dayOccurrences = occurrencesByDate[date] ?? [];
          const dayTasks = dayOccurrences.filter((o) => !o.isHistorical).map((o) => o.task);
          const isTodayDate = date === today;
          const dateLabel = formatTimelineDate(date);
          const timelineKicker = getTimelineKicker(date, today, tomorrow);
          const unresolvedCount = dayOccurrences.filter((o) => !o.isHistorical && o.task.status !== "completed" && o.task.status !== "cancelled" && isPast(date)).length;

          return (
            <motion.section
              key={date}
              ref={isTodayDate ? todayRef : null}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="relative"
              style={{ zIndex: 20 - index }}
            >
              <div className={`rounded-[20px] transition-all ${isTodayDate ? "glass-card-today" : "glass-card"}`}>
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                        isTodayDate ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
                      }`}>
                        {timelineKicker}
                      </span>
                      <span className="text-[22px] font-bold text-gray-900 dark:text-gray-100 leading-tight">
                        {dateLabel}
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
                      {filter === "deferred" ? "No deferred tasks this day" : "No tasks planned"}
                    </p>
                  ) : (
                    <DayTaskList
                      occurrences={dayOccurrences}
                      onReorder={handleReorderDate(date)}
                      onDone={markDone}
                      onUndone={markUndone}
                      onUpdate={updateIdea}
                      onReschedule={handleReschedule}
                      onCancel={handleCancel}
                      today={today}
                      allTags={tagsHook.tags}
                      getTagsForIdea={taskTagsHook.getTagsForIdea}
                      onAddTag={taskTagsHook.addTagToTask}
                      onRemoveTag={taskTagsHook.removeTagFromTask}
                      onCreateTag={tagsHook.createTag}
                    />
                  )}
                </div>

                {filter === "all" && (
                  <div className="px-5 pb-4 pt-1">
                    <QuickAddInput
                      placeholder={`+ Add task for ${isTodayDate ? "today" : dateLabel}...`}
                      onAdd={(text) => handleQuickAdd(text, date)}
                    />
                  </div>
                )}
              </div>
            </motion.section>
          );
        })
        )}
      </div>

      {/* <FloatingAddButton
        open={fabOpen}
        onOpen={() => setFabOpen(true)}
        onClose={() => setFabOpen(false)}
        onAdd={handleFabAdd}
        today={today}
      /> */}
    </AppShell>
  );
}
