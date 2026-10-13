"use client";

import { useRef, useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useIdeaLinks } from "@/hooks/useIdeaLinks";
import { useClassifications } from "@/hooks/useClassifications";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { LifeArea } from "@/lib/types";
import { getToday, getTomorrow, isPlanDate } from "@/lib/dateUtils";
import { STORAGE_KEYS, writeJson } from "@/lib/storage";
import { useUndoAction } from "@/lib/tasks/undo";
import { MonthGridView } from "@/components/timeline/MonthGridView";
import { WeekStripView, type WeekCardPreview } from "@/components/timeline/WeekStripView";
import { UndoBar } from "@/components/shared/UndoBar";
import { DateNav } from "@/components/planner/DateNav";
import { hasAnyEffects } from "@/lib/linkEffects";
import { useTimelineActions } from "@/hooks/useTimelineActions";
import { useTimelineModel } from "@/hooks/useTimelineModel";
import { useCompletionEffects } from "@/stores/feedbackStore";
import { LinkedEffectsReveal } from "@/components/shared/LinkedEffectsReveal";
import { AgendaDayCard, AgendaGap } from "@/components/timeline/AgendaDayCard";
import { TimelineFloatingControls, TimelineToolbar } from "@/components/timeline/TimelineToolbar";
import { loadTimelinePrefs, type TimelinePresetId, type TimelineView } from "@/lib/timelinePresets";

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
  const {
    ideas,
    loading,
    createIdea,
    markDone,
    markUndone,
    updateIdea,
    moveIdea,
    reorderTasks,
    smartSortTasks,
  } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
  const linksHook = useIdeaLinks();
  const { getOptionForIdea } = useClassifications();
  const scrolledAnchorRef = useRef<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [renderedAnchor, setRenderedAnchor] = useState<string | null>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [rangeFlash, setRangeFlash] = useState(false);
  const [filter, setFilter] = useState<"all" | "deferred">(() => loadTimelinePrefs().filter);
  const [preset, setPreset] = useState<TimelinePresetId>(() => loadTimelinePrefs().preset);
  const [view, setView] = useState<TimelineView>(() => loadTimelinePrefs().view);
  const [weekCardPreview, setWeekCardPreview] = useState<WeekCardPreview>(
    () => loadTimelinePrefs().weekCardPreview ?? "top",
  );
  const [quickAddArea, setQuickAddArea] = useState<LifeArea | null>(null);
  const [anchorVisible, setAnchorVisible] = useState(true);
  const [todayVisible, setTodayVisible] = useState(true);
  const [scrollRequest, setScrollRequest] = useState(0);
  const { undoAction, clearUndo, handleUndo } = useUndoAction();
  const { completionEffects, setCompletionEffects } = useCompletionEffects();

  const today = getToday();
  const tomorrow = getTomorrow();
  const anchorParam = searchParams.get("date");
  const anchor = anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam) ? anchorParam : today;
  const highlightId = searchParams.get("highlight");

  const {
    dates,
    hasRevisitDates,
    effectiveFilter,
    monthGridDates,
    weekDates,
    occurrencesByDate,
    rangeCounts,
    rangeSpans,
    renderPlan,
    noDeferredActivity,
  } = useTimelineModel({ ideas, anchor, today, preset, filter });

  const handleFilterChange = (id: "all" | "deferred") => {
    setFilter(id);
  };

  useEffect(() => {
    writeJson(STORAGE_KEYS.timelinePrefs, { filter, preset, view, weekCardPreview });
  }, [filter, preset, view, weekCardPreview]);

  // Outside-click, Escape, scroll and resize handling for the range menu
  // is owned by FloatingPanel (see RangeWindowDropdown).

  // Auto-scroll to the selected (anchor) day once data has loaded, and on every
  // URL-driven anchor change (e.g. browser back/forward or ?date= deep links).
  useEffect(() => {
    if (
      loading ||
      scrolledAnchorRef.current === anchor ||
      renderedAnchor !== anchor ||
      !anchorRef.current
    )
      return;
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
    // Guarantee the highlight target is visible: the "Deferred" filter hides
    // completed/cancelled occurrences on past dates.
    const target = ideas.find((i) => i.id === highlightId);
    if (
      target &&
      (target.status === "completed" ||
        target.status === "cancelled" ||
        target.status === "missed") &&
      filter !== "all"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link lifts hiding filter
      setFilter("all");
    }
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
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- highlight deep-link runs once per highlightId
  }, [highlightId, anchor, loading, renderedAnchor, router, searchParams]);

  const {
    priorityRankOf,
    handleQuickAdd,
    handleReschedule,
    handleDone,
    handleUpdate,
    handleReorderDate,
    setAnchorParam,
    handleAnchorChange,
    handleGoToDate,
    handleMove,
    handleCreateLink,
    handleDeleteLink,
  } = useTimelineActions({
    ideas,
    ideasApi: { createIdea, markDone, updateIdea, moveIdea, reorderTasks },
    linksHook,
    tagsHook,
    taskTagsHook,
    getOptionForIdea,
    setCompletionEffects,
  });

  const setAnchorReady = useCallback((date: string, node: HTMLDivElement) => {
    anchorRef.current = node;
    setRenderedAnchor(date);
  }, []);

  const setTodayReady = useCallback((_date: string, node: HTMLDivElement) => {
    todayRef.current = node;
  }, []);

  // Track anchor visibility in viewport
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setAnchorVisible(entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor, loading, anchorRef]);

  // Track today's card visibility in viewport (sticky Today pill)
  useEffect(() => {
    const el = todayRef.current;
    if (!el) {
      setTodayVisible(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setTodayVisible(entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [anchor, loading, view, dates]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const headerActions =
    view === "agenda" ? (
      <DateNav
        activeDate={anchor}
        today={today}
        showDateInput={showDateInput}
        onShowDateInput={setShowDateInput}
        onChangeDate={handleAnchorChange}
      />
    ) : undefined;

  // Sticky Today pill: agenda tracks the live card visibility, week/month
  // check whether today is in the displayed dates (all derived at page level).
  const showTodayPill =
    view === "agenda"
      ? !todayVisible
      : view === "week"
        ? !weekDates.includes(today)
        : !monthGridDates.includes(today);

  const headerStartActions = (
    <TimelineToolbar
      view={view}
      filter={filter}
      hasRevisitDates={hasRevisitDates}
      preset={preset}
      rangeCounts={rangeCounts}
      rangeSpans={rangeSpans}
      windowMenuOpen={windowMenuOpen}
      onViewChange={setView}
      onFilterChange={handleFilterChange}
      onToggleWindowMenu={() => setWindowMenuOpen((v) => !v)}
      onCloseWindowMenu={() => setWindowMenuOpen(false)}
      onSelectPreset={(id) => {
        setPreset(id);
        setRangeFlash(true);
        window.setTimeout(() => setRangeFlash(false), 900);
        setWindowMenuOpen(false);
      }}
    />
  );

  return (
    <AppShell
      title="Timeline"
      headerActions={headerActions}
      headerStartActions={headerStartActions}
      fullWidth={view !== "agenda"}
    >
      <div className={`space-y-4 pb-24 ${rangeFlash ? "timeline-range-updated" : ""}`}>
        <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />
        {completionEffects && hasAnyEffects(completionEffects.effects) && (
          <LinkedEffectsReveal
            effects={completionEffects.effects}
            completedText={completionEffects.completedText}
            onClose={() => setCompletionEffects(null)}
          />
        )}

        {view === "month" ? (
          <MonthGridView
            gridDates={monthGridDates}
            anchor={anchor}
            today={today}
            occurrencesByDate={occurrencesByDate}
            onAnchorChange={handleAnchorChange}
            onOpenDay={(d) => {
              setView("agenda");
              setAnchorParam(d);
            }}
            onReorder={handleReorderDate}
            onDone={handleDone}
            onUndone={markUndone}
            onUpdate={handleUpdate}
            onReschedule={handleReschedule}
            onMove={handleMove}
            onSmartSort={(dayTasks) => smartSortTasks(dayTasks, priorityRankOf)}
            ideas={ideas}
            links={linksHook.links}
            onCreateLink={handleCreateLink}
            onDeleteLink={handleDeleteLink}
            onGoToDate={handleGoToDate}
            allTags={tagsHook.tags}
            getTagsForIdea={taskTagsHook.getTagsForIdea}
            onAddTag={taskTagsHook.addTagToTask}
            onRemoveTag={taskTagsHook.removeTagFromTask}
            onCreateTag={tagsHook.createTag}
            quickAddArea={quickAddArea}
            onQuickAddAreaChange={setQuickAddArea}
            onQuickAdd={(text, date) => handleQuickAdd(text, date, quickAddArea)}
            showQuickAdd={(date) => effectiveFilter === "all" || isPlanDate(date)}
          />
        ) : view === "week" ? (
          <WeekStripView
            weekDates={weekDates}
            anchor={anchor}
            today={today}
            tomorrow={tomorrow}
            occurrencesByDate={occurrencesByDate}
            showQuickAdd={(date) => effectiveFilter === "all" || isPlanDate(date)}
            onAnchorChange={handleAnchorChange}
            onOpenDay={(d) => {
              setView("agenda");
              setAnchorParam(d);
            }}
            onReorder={handleReorderDate}
            onDone={handleDone}
            onUndone={markUndone}
            onUpdate={handleUpdate}
            onReschedule={handleReschedule}
            onMove={handleMove}
            onSmartSort={(dayTasks) => smartSortTasks(dayTasks, priorityRankOf)}
            ideas={ideas}
            links={linksHook.links}
            onCreateLink={handleCreateLink}
            onDeleteLink={handleDeleteLink}
            onGoToDate={handleGoToDate}
            allTags={tagsHook.tags}
            getTagsForIdea={taskTagsHook.getTagsForIdea}
            onAddTag={taskTagsHook.addTagToTask}
            onRemoveTag={taskTagsHook.removeTagFromTask}
            onCreateTag={tagsHook.createTag}
            quickAddArea={quickAddArea}
            onQuickAddAreaChange={setQuickAddArea}
            onQuickAdd={(text, date) => handleQuickAdd(text, date, quickAddArea)}
            suggestFrom={ideas}
            cardPreview={weekCardPreview}
            onCardPreviewChange={setWeekCardPreview}
          />
        ) : noDeferredActivity ? (
          <div className="glass-card rounded-2xl border border-dashed border-black/5 py-20 text-center text-gray-400 dark:border-white/5 dark:text-gray-500">
            <Clock size={32} className="mx-auto mb-3 text-gray-300 opacity-60 dark:text-gray-600" />
            <p className="mb-1 text-sm font-semibold">No deferred tasks</p>
            <p className="text-xs">No tasks found in the selected range.</p>
          </div>
        ) : (
          renderPlan.map((unit, index) => {
            if (unit.kind === "gap") {
              return <AgendaGap key={`gap-${index}`} count={unit.count} />;
            }
            const date = unit.date;
            return (
              <AgendaDayCard
                key={date}
                index={index}
                date={date}
                anchor={anchor}
                today={today}
                tomorrow={tomorrow}
                occurrences={occurrencesByDate[date] ?? []}
                effectiveFilter={effectiveFilter}
                quickAddArea={quickAddArea}
                onQuickAddAreaChange={setQuickAddArea}
                onQuickAdd={handleQuickAdd}
                onSmartSort={(dayTasks) => smartSortTasks(dayTasks, priorityRankOf)}
                onPlan={(d) => router.push(`/?date=${d}`)}
                onAnchorReady={setAnchorReady}
                onTodayReady={setTodayReady}
                onReorder={handleReorderDate}
                onDone={handleDone}
                onUndone={markUndone}
                onUpdate={handleUpdate}
                onReschedule={handleReschedule}
                onMove={handleMove}
                ideas={ideas}
                links={linksHook.links}
                onCreateLink={handleCreateLink}
                onDeleteLink={handleDeleteLink}
                onGoToDate={handleGoToDate}
                allTags={tagsHook.tags}
                getTagsForIdea={taskTagsHook.getTagsForIdea}
                onAddTag={taskTagsHook.addTagToTask}
                onRemoveTag={taskTagsHook.removeTagFromTask}
                onCreateTag={tagsHook.createTag}
              />
            );
          })
        )}
      </div>

      <TimelineFloatingControls
        anchor={anchor}
        anchorVisible={anchorVisible}
        showTodayPill={showTodayPill}
        onJumpToAnchor={() => setScrollRequest((request) => request + 1)}
        onJumpToToday={() => {
          // Anchor already today (e.g. scrolled away manually): replacing
          // the URL would be a no-op, so re-center via scrollRequest instead.
          if (anchor === today) setScrollRequest((request) => request + 1);
          else handleAnchorChange(today);
        }}
      />
    </AppShell>
  );
}
