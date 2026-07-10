"use client";

import { useState, useMemo, useCallback } from "react";
import { DailyTimeline } from "@papesce/dayslot";
import type { TimelineEvent } from "@papesce/dayslot";
import "@papesce/dayslot/style.css";
import { Idea, LifeArea, getAreasForIdea, Tag } from "@/lib/types";
import { AREA_LABELS } from "./constants";
import {
  minutesToTimeString,
  parseTimeToMinutes,
} from "./dayslotAdapter";

interface DayslotTimelineProps {
  activeDate: string;
  allTasks: Idea[];
  onUpdateTask: (id: string, updates: Partial<Idea>) => void;
  onCreateTask: (text: string, time: string) => Promise<void>;
  getTagsForIdea: (ideaId: string) => Tag[];
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
  health: "bg-red-50/65 border-red-200/40 dark:bg-red-950/15 dark:border-red-900/25 text-red-700 dark:text-red-300",
  relationships: "bg-pink-50/65 border-pink-200/40 dark:bg-pink-950/15 dark:border-pink-900/25 text-pink-700 dark:text-pink-300",
  growth: "bg-amber-50/65 border-amber-200/40 dark:bg-amber-950/15 dark:border-amber-900/25 text-amber-700 dark:text-amber-300",
  finances: "bg-emerald-50/65 border-emerald-200/40 dark:bg-emerald-950/15 dark:border-emerald-900/25 text-emerald-700 dark:text-emerald-300",
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

function SlotForm({
  startMinute,
  close,
  onCreateTask,
}: {
  startMinute: number;
  close: () => void;
  onCreateTask: (text: string, time: string) => Promise<void>;
}) {
  const [text, setText] = useState("");

  const timeStr = minutesToTimeString(startMinute);

  const handleAdd = async () => {
    if (!text.trim()) return;
    await onCreateTask(text.trim(), timeStr);
    close();
  };

  return (
    <div className="w-full flex flex-col gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] p-2 rounded-xl border border-black/5 dark:border-white/5">
      <input
        type="text"
        placeholder={`Add task at ${timeStr}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) void handleAdd();
          if (e.key === "Escape") close();
        }}
        className="w-full bg-white/80 dark:bg-gray-800/80 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 text-gray-800 dark:text-gray-200"
        autoFocus
      />
      <div className="flex justify-end items-center gap-2">
        <button
          onClick={close}
          className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleAdd()}
          className="text-[10px] bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 font-bold cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function taskToEvent(idea: Idea, tags: Tag[]): TimelineEvent {
  const areas = getAreasForIdea(tags);
  const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);

  return {
    id: idea.id,
    title: idea.text,
    startMinute: idea.scheduled_time
      ? parseTimeToMinutes(idea.scheduled_time)
      : 480,
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
}: DayslotTimelineProps) {
  const isToday = activeDate === new Date().toISOString().slice(0, 10);
  const scheduledTasks = useMemo(
    () => allTasks.filter((t) => t.scheduled_time && t.status !== "archived"),
    [allTasks],
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
        />
      );
    },
    [onCreateTask],
  );

  const renderEventContent = useCallback(
    (event: TimelineEvent) => {
      const idea = scheduledTasks.find((t) => t.id === event.id);
      if (!idea) return null;
      const isCompleted = idea.status === "completed";
      const isCancelled = idea.status === "cancelled";

      const tags = getTagsForIdea(idea.id);
      const areas = getAreasForIdea(tags);
      const area = areas[0] || "life";
      const bgClass = AREA_BG_CLASSES[area] || AREA_BG_CLASSES.life;
      const accentColor = AREA_ACCENT_COLORS[area] || AREA_ACCENT_COLORS.life;

      return (
        <div className={`flex h-full w-full rounded-[9px] border backdrop-blur-md transition-all duration-200 ${bgClass}`}>
          <div
            className="w-1 flex-shrink-0 rounded-l-full my-1.5 ml-1.5"
            style={{ background: accentColor }}
          />
          <div className="flex-1 flex flex-col justify-between min-w-0 px-2 py-1.5">
            <span
              className={`text-[10px] font-bold leading-tight break-words ${
                isCompleted
                  ? "line-through opacity-50"
                  : isCancelled
                    ? "opacity-50"
                    : ""
              }`}
            >
              {event.title}
            </span>
            <div className="flex items-center justify-between mt-auto pt-1">
              {event.category && (
                <span className="text-[8px] font-bold opacity-60">
                  {event.category}
                </span>
              )}
              {event.durationMinutes > 0 && (
                <span className="text-[8px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-bold tabular-nums">
                  {event.durationMinutes}m
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
    [scheduledTasks, getTagsForIdea],
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
      <DailyTimeline
        events={events}
        startHour={7}
        endHour={22}
        hourHeight={128}
        snapMinutes={15}
        height="1100px"
        title="Daily Timeline"
        onEventChange={handleEventChange}
        onExternalDrop={handleExternalDrop}
        onEventRemove={handleEventRemove}
        externalDragDuration={30}
        renderEventContent={renderEventContent}
        renderSlotAction={renderSlotAction}
        showCurrentTime={isToday}
        slotActionTrigger="button"
        slotIntervalMinutes={30}
      />
    </div>
  );
}
