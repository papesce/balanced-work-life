"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { DailyTimeline } from "@papesce/dayslot";
import type { TimelineEvent, DailyTimelineHandle } from "@papesce/dayslot";
import "@papesce/dayslot/style.css";
import { Idea, LifeArea, getAreasForIdea, Tag } from "@/lib/types";
import { AREA_LABELS } from "@/lib/constants";
import { computeReschedulePatch, tryNowAction } from "@/lib/tasks/rescheduleTask";
import { minutesToTimeString, parseTimeToMinutes } from "./dayslotAdapter";
import { SlotForm } from "./SlotForm";
import { EventCard } from "./TimelineEventCard";
import { PLANNER_TIMELINE_ID, usePlannerDnd } from "./PlannerDnd";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

interface DayslotTimelineProps {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (
    text: string,
    time: string,
    area?: LifeArea,
    tag?: Tag,
    productivitySignal?: string | null,
  ) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
  tags: Tag[];
  selectedArea: LifeArea | null;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onSelectEvent?: (eventId: string) => void;
}

const AREA_ACCENT_COLORS: Record<LifeArea, string> = {
  work: "#3b82f6",
  health: "#ef4444",
  relationships: "#ec4899",
  growth: "#f59e0b",
  finances: "#10b981",
  life: "#8b5cf6",
};

const AREA_BG_CLASSES: Record<LifeArea, string> = {
  work: "bg-blue-50/65 border-blue-200/40 dark:bg-blue-950/15 dark:border-blue-900/25 text-blue-700 dark:text-blue-300",
  health:
    "bg-red-50/65 border-red-200/40 dark:bg-red-950/15 dark:border-red-900/25 text-red-700 dark:text-red-300",
  relationships:
    "bg-pink-50/65 border-pink-200/40 dark:bg-pink-950/15 dark:border-pink-900/25 text-pink-700 dark:text-pink-300",
  growth:
    "bg-amber-50/65 border-amber-200/40 dark:bg-amber-950/15 dark:border-amber-900/25 text-amber-700 dark:text-amber-300",
  finances:
    "bg-emerald-50/65 border-emerald-200/40 dark:bg-emerald-950/15 dark:border-emerald-900/25 text-emerald-700 dark:text-emerald-300",
  life: "bg-violet-50/65 border-violet-200/40 dark:bg-violet-950/15 dark:border-violet-900/25 text-violet-700 dark:text-violet-300",
};

function getCategoryColor(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  return area ? AREA_ACCENT_COLORS[area] : undefined;
}

function getCategoryLabel(areas: LifeArea[]): string | undefined {
  const area = areas[0];
  return area ? AREA_LABELS[area] : undefined;
}

function taskToEvent(idea: Idea, tags: Tag[]): TimelineEvent {
  const areas = getAreasForIdea(tags);
  const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);

  return {
    id: idea.id,
    title: idea.text,
    startMinute: idea.scheduled_time ? parseTimeToMinutes(idea.scheduled_time) : 480,
    durationMinutes: idea.duration_minutes ?? 30,
    color: getCategoryColor(effectiveAreas),
    category: getCategoryLabel(effectiveAreas),
  };
}

export function DayslotTimeline({
  activeDate,
  allTasks,
  onUpdateTask,
  onCreateTask,
  getTagsForIdea,
  tags,
  selectedArea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onSelectEvent,
}: DayslotTimelineProps) {
  const isToday = activeDate === new Date().toISOString().slice(0, 10);
  const isMobile = useIsMobile();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const pendingCounter = useRef(0);
  const hourHeight = isMobile ? 80 : 128;
  const startHour = 7;
  const endHour = 22;
  const snapMinutes = 15;
  const { setNodeRef: setTimelineDropRef, isOver: isDropOver } = useDroppable({
    id: PLANNER_TIMELINE_ID,
  });
  const { registerTimeline, overTimeline, activeDrag, timelinePreviewMinute } = usePlannerDnd();
  const [pendingEvents, setPendingEvents] = useState<
    Array<{ id: string; startMinute: number; text: string; durationMinutes: number }>
  >([]);
  // Optimistic positions for schedule-drops (middle → timeline) and
  // in-timeline moves. Keyed by task id, cleared once live `allTasks`
  // converges on the pending minute (or rolled back on write failure).
  const [pendingPositions, setPendingPositions] = useState<
    Map<string, { startMinute: number; durationMinutes?: number }>
  >(() => new Map());
  const prevActiveDragRef = useRef<string | null>(null);
  const lastPreviewMinuteRef = useRef<number | null>(null);
  const lastOverTimelineRef = useRef(false);

  const handleTimelineRef = useCallback((handle: DailyTimelineHandle | null) => {
    setScrollEl(handle?.scrollElement ?? null);
  }, []);

  // Publish the timeline scroll body + grid metrics so the planner DndContext
  // can convert pointer position into a snapped drop minute (no dataTransfer).
  useEffect(() => {
    registerTimeline({ scrollElement: scrollEl, startHour, endHour, hourHeight, snapMinutes });
  }, [scrollEl, hourHeight, registerTimeline]);

  // Commit a pending position when a middle-section drag ends over the
  // timeline. Dayslot doesn't see DragEnd directly, so infer the drop from
  // the activeDrag → null transition (the provider resets on drag end).
  useEffect(() => {
    if (activeDrag) {
      prevActiveDragRef.current = activeDrag.taskId;
      if (timelinePreviewMinute !== null) lastPreviewMinuteRef.current = timelinePreviewMinute;
      lastOverTimelineRef.current = overTimeline;
      return;
    }
    const droppedTaskId = prevActiveDragRef.current;
    const wasOverTimeline = lastOverTimelineRef.current;
    const minute = lastPreviewMinuteRef.current;
    prevActiveDragRef.current = null;
    lastOverTimelineRef.current = false;
    if (droppedTaskId && wasOverTimeline && minute !== null) {
      lastPreviewMinuteRef.current = null;
      setPendingPositions((prev) => {
        const next = new Map(prev);
        next.set(droppedTaskId, { startMinute: minute });
        return next;
      });
    }
  }, [activeDrag, timelinePreviewMinute, overTimeline]);

  // Clear pending positions once live data converges (or the task vanished).
  useEffect(() => {
    if (pendingPositions.size === 0) return;
    const liveById = new Map(allTasks.map((t) => [t.id, t] as const));
    let changed = false;
    const next = new Map(pendingPositions);
    for (const [taskId, pending] of pendingPositions) {
      const live = liveById.get(taskId);
      if (!live) {
        next.delete(taskId);
        changed = true;
      } else if (
        live.scheduled_time &&
        parseTimeToMinutes(live.scheduled_time) === pending.startMinute &&
        (pending.durationMinutes === undefined || live.duration_minutes === pending.durationMinutes)
      ) {
        next.delete(taskId);
        changed = true;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- converge optimistic positions into live query results
    if (changed) setPendingPositions(next);
  }, [allTasks, pendingPositions]);

  const scheduledTasks = useMemo(
    () => allTasks.filter((t) => t.scheduled_time && t.status !== "archived"),
    [allTasks],
  );
  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t] as const)), [allTasks]);
  const stableCustomProps = useMemo(
    () => ({ "--ds-event-padding": "0" }) as Record<string, string>,
    [],
  );

  const events = useMemo(() => {
    const livePreviewId =
      activeDrag && overTimeline && timelinePreviewMinute !== null ? activeDrag.taskId : null;
    const withPending = new Map<string, TimelineEvent>();
    for (const t of scheduledTasks) {
      const pending = pendingPositions.get(t.id);
      const base = taskToEvent(t, getTagsForIdea(t.id));
      withPending.set(t.id, {
        ...base,
        startMinute: pending?.startMinute ?? base.startMinute,
        durationMinutes: pending?.durationMinutes ?? base.durationMinutes,
      });
    }
    // Drops from the middle section: task has no scheduled_time yet live,
    // but the pending position makes it appear instantly.
    for (const [taskId, pending] of pendingPositions) {
      if (withPending.has(taskId)) continue;
      const task = taskMap.get(taskId);
      if (!task) continue;
      const base = taskToEvent(task, getTagsForIdea(taskId));
      withPending.set(taskId, {
        ...base,
        startMinute: pending.startMinute,
        durationMinutes: pending.durationMinutes ?? base.durationMinutes,
      });
    }
    // Live position while the pointer is still over the timeline.
    if (livePreviewId && !pendingPositions.has(livePreviewId)) {
      const task = taskMap.get(livePreviewId);
      if (task) {
        const base = taskToEvent(task, getTagsForIdea(livePreviewId));
        withPending.set(livePreviewId, {
          ...base,
          startMinute: timelinePreviewMinute as number,
          durationMinutes: activeDrag?.durationMinutes ?? base.durationMinutes,
        });
      }
    }
    return [
      ...withPending.values(),
      ...pendingEvents.map((pe) => ({
        id: pe.id,
        title: pe.text,
        startMinute: pe.startMinute,
        durationMinutes: pe.durationMinutes,
        color: undefined,
        category: undefined,
      })),
    ];
  }, [
    scheduledTasks,
    getTagsForIdea,
    pendingEvents,
    pendingPositions,
    taskMap,
    activeDrag,
    overTimeline,
    timelinePreviewMinute,
  ]);

  const handleEventChange = useCallback(
    (event: TimelineEvent) => {
      setPendingPositions((prev) => {
        const next = new Map(prev);
        next.set(event.id, {
          startMinute: event.startMinute,
          durationMinutes: event.durationMinutes,
        });
        return next;
      });
      void Promise.resolve(
        onUpdateTask(event.id, {
          scheduled_time: minutesToTimeString(event.startMinute),
          duration_minutes: event.durationMinutes,
        }),
      ).catch(() => {
        setPendingPositions((prev) => {
          if (!prev.has(event.id)) return prev;
          const next = new Map(prev);
          next.delete(event.id);
          return next;
        });
      });
    },
    [onUpdateTask],
  );

  const handleEventClick = useCallback(
    (event: TimelineEvent) => {
      onSelectEvent?.(event.id);
    },
    [onSelectEvent],
  );

  const handleEventRemove = useCallback(
    (event: TimelineEvent) => {
      // Drop any optimistic position so the event vanishes instantly;
      // the useIdeas overlay + live query drive the confirmed state.
      setPendingPositions((prev) => {
        if (!prev.has(event.id)) return prev;
        const next = new Map(prev);
        next.delete(event.id);
        return next;
      });
      onUpdateTask(event.id, { scheduled_time: null });
    },
    [onUpdateTask],
  );

  const handleTryNow = useCallback(
    (id: string) => {
      const idea = taskMap.get(id) ?? allTasks.find((t) => t.id === id);
      if (!idea) return;
      onUpdateTask(id, computeReschedulePatch(idea, tryNowAction()));
    },
    [taskMap, allTasks, onUpdateTask],
  );

  const wrappedOnCreateTask = useCallback(
    async (
      text: string,
      time: string,
      area?: LifeArea,
      tag?: Tag,
      productivitySignal?: string | null,
    ) => {
      const tempId = `pending-${++pendingCounter.current}`;
      setPendingEvents((prev) => [
        ...prev,
        { id: tempId, startMinute: parseTimeToMinutes(time), text, durationMinutes: 30 },
      ]);
      try {
        await onCreateTask(text, time, area, tag, productivitySignal);
      } finally {
        setPendingEvents((prev) => prev.filter((e) => e.id !== tempId));
      }
    },
    [onCreateTask],
  );

  const renderSlotAction = useCallback(
    (startMinute: number, close: () => void) => {
      return (
        <SlotForm
          startMinute={startMinute}
          close={close}
          onCreateTask={wrappedOnCreateTask}
          defaultArea={selectedArea}
          tags={tags}
          onCreateTag={onCreateTag}
          suggestFrom={allTasks}
        />
      );
    },
    [wrappedOnCreateTask, selectedArea, tags, onCreateTag, allTasks],
  );

  const renderEventContent = useCallback(
    (event: TimelineEvent) => {
      if (event.id.startsWith("pending-")) {
        return (
          <div className="flex h-full w-full animate-pulse rounded-[9px] border border-dashed border-gray-300 bg-gray-100/50 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="my-1.5 ml-1.5 w-1 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="flex min-w-0 flex-1 flex-col justify-between px-2 py-1.5">
              <div className="h-2.5 w-3/4 rounded bg-gray-300 dark:bg-gray-600" />
              <div className="mt-auto flex items-center gap-2 pt-1 pb-2">
                <div className="h-2 w-8 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-2 w-6 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          </div>
        );
      }

      const idea = taskMap.get(event.id);
      if (!idea) return null;
      const isCompleted = idea.status === "completed";
      const isCancelled = idea.status === "cancelled" || idea.status === "missed";

      const tagsForIdea = getTagsForIdea(idea.id);
      const areas = getAreasForIdea(tagsForIdea);
      const area = areas[0] || "life";
      const bgClass = AREA_BG_CLASSES[area] || AREA_BG_CLASSES.life;
      const accentColor = AREA_ACCENT_COLORS[area] || AREA_ACCENT_COLORS.life;

      return (
        <EventCard
          idea={idea}
          event={event}
          areaTags={tagsForIdea}
          allTags={tags}
          bgClass={bgClass}
          accentColor={accentColor}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          scrollElement={scrollEl}
          onUpdateTask={onUpdateTask}
          onTryNow={handleTryNow}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
        />
      );
    },
    [
      taskMap,
      getTagsForIdea,
      tags,
      scrollEl,
      onUpdateTask,
      handleTryNow,
      onAddTag,
      onRemoveTag,
      onCreateTag,
    ],
  );

  return (
    <div
      ref={setTimelineDropRef}
      className={`glass-card overflow-hidden rounded-2xl border border-black/5 transition-all duration-200 dark:border-white/5 ${
        isDropOver || overTimeline ? "bg-violet-500/[0.03] ring-2 ring-violet-500/50" : ""
      }`}
    >
      <DailyTimeline
        events={events}
        startHour={startHour}
        endHour={endHour}
        hourHeight={hourHeight}
        snapMinutes={snapMinutes}
        height={isMobile ? "auto" : "1100px"}
        title="Daily Timeline"
        timelineRef={handleTimelineRef}
        onEventChange={handleEventChange}
        onEventClick={handleEventClick}
        onEventRemove={handleEventRemove}
        renderEventContent={renderEventContent}
        renderSlotAction={renderSlotAction}
        showCurrentTime={isToday}
        slotActionTrigger="button"
        slotMinutes={15}
        customProperties={stableCustomProps}
      />
    </div>
  );
}
