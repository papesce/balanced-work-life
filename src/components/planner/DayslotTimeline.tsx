"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DailyTimeline } from "@papesce/dayslot";
import type { TimelineEvent, DailyTimelineHandle } from "@papesce/dayslot";
import "@papesce/dayslot/style.css";
import { Idea, LifeArea, getAreasForIdea, Tag } from "@/lib/types";
import { AREA_LABELS } from "@/lib/constants";
import { minutesToTimeString, parseTimeToMinutes } from "./dayslotAdapter";
import { SlotForm } from "./SlotForm";
import { EventCard } from "./TimelineEventCard";

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

  const handleTimelineRef = useCallback((handle: DailyTimelineHandle | null) => {
    setScrollEl(handle?.scrollElement ?? null);
  }, []);
  const scheduledTasks = useMemo(
    () => allTasks.filter((t) => t.scheduled_time && t.status !== "archived"),
    [allTasks],
  );
  const taskMap = useMemo(
    () => new Map(scheduledTasks.map((t) => [t.id, t] as const)),
    [scheduledTasks],
  );
  const stableCustomProps = useMemo(
    () => ({ "--ds-event-padding": "0" }) as Record<string, string>,
    [],
  );

  const events = useMemo(
    () => scheduledTasks.map((t) => taskToEvent(t, getTagsForIdea(t.id))),
    [scheduledTasks, getTagsForIdea],
  );

  const handleEventChange = useCallback(
    (event: TimelineEvent) => {
      onUpdateTask(event.id, {
        scheduled_time: minutesToTimeString(event.startMinute),
        duration_minutes: event.durationMinutes,
      });
    },
    [onUpdateTask],
  );

  const handleExternalDrop = useCallback(
    (taskId: string, startMinute: number) => {
      onUpdateTask(taskId, {
        scheduled_time: minutesToTimeString(startMinute),
        status: "scheduled",
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
      onUpdateTask(event.id, { scheduled_time: null });
    },
    [onUpdateTask],
  );

  const renderSlotAction = useCallback(
    (startMinute: number, close: () => void) => {
      return (
        <SlotForm
          startMinute={startMinute}
          close={close}
          onCreateTask={onCreateTask}
          defaultArea={selectedArea}
          tags={tags}
          onCreateTag={onCreateTag}
        />
      );
    },
    [onCreateTask, selectedArea, tags, onCreateTag],
  );

  const renderEventContent = useCallback(
    (event: TimelineEvent) => {
      const idea = taskMap.get(event.id);
      if (!idea) return null;
      const isCompleted = idea.status === "completed";
      const isCancelled = idea.status === "cancelled";

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
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onCreateTag={onCreateTag}
        />
      );
    },
    [taskMap, getTagsForIdea, tags, scrollEl, onUpdateTask, onAddTag, onRemoveTag, onCreateTag],
  );

  return (
    <div className="glass-card overflow-hidden rounded-2xl border border-black/5 dark:border-white/5">
      <DailyTimeline
        events={events}
        startHour={7}
        endHour={22}
        hourHeight={isMobile ? 80 : 128}
        snapMinutes={15}
        height={isMobile ? "auto" : "1100px"}
        title="Daily Timeline"
        timelineRef={handleTimelineRef}
        onEventChange={handleEventChange}
        onEventClick={handleEventClick}
        onExternalDrop={handleExternalDrop}
        onEventRemove={handleEventRemove}
        externalDragDuration={30}
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
