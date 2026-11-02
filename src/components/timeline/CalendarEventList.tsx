"use client";

import { CalendarDays } from "lucide-react";
import type { Idea } from "@/lib/types";

export function CalendarEventList({
  events,
  onSelect,
  compact = false,
  maxItems,
}: {
  events: Idea[];
  onSelect: (event: Idea) => void;
  compact?: boolean;
  maxItems?: number;
}) {
  if (events.length === 0) return null;

  const visible = maxItems ? events.slice(0, maxItems) : events;
  const overflow = events.length - visible.length;
  const allDay = visible.filter((event) => !event.scheduled_time);
  const timed = visible.filter((event) => !!event.scheduled_time);
  const buttonClass = compact
    ? "flex w-full min-w-0 items-center gap-1 truncate rounded-md bg-indigo-50/80 px-1 py-0.5 text-left text-[9px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
    : "flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-900/20";

  const durationLabel = (minutes: number) =>
    minutes >= 60 && minutes % 60 === 0
      ? `${minutes / 60}h`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`;

  const renderEvent = (event: Idea) => (
    <button
      key={event.id}
      type="button"
      title={`${event.text}${event.scheduled_time ? ` · ${event.scheduled_time.slice(0, 5)}` : " · All day"}`}
      aria-label={`Edit event ${event.text}${event.scheduled_time ? ` at ${event.scheduled_time.slice(0, 5)}` : ", all day"}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
      className={buttonClass}
      style={
        !compact && event.scheduled_time && event.duration_minutes
          ? { minHeight: `${Math.max(36, Math.ceil(event.duration_minutes / 30) * 28)}px` }
          : undefined
      }
    >
      <CalendarDays size={compact ? 10 : 13} className="shrink-0" />
      {event.scheduled_time && (
        <span className="shrink-0 tabular-nums">{event.scheduled_time.slice(0, 5)}</span>
      )}
      <span className="truncate">{event.text || "Untitled event"}</span>
      {!compact && event.scheduled_time && event.duration_minutes && (
        <span className="ml-auto shrink-0 text-[10px] font-medium text-indigo-500 dark:text-indigo-300">
          {durationLabel(event.duration_minutes)}
        </span>
      )}
    </button>
  );

  return (
    <div
      className={compact ? "space-y-px" : "space-y-1.5"}
      aria-label={`${events.length} calendar event${events.length === 1 ? "" : "s"}`}
    >
      {allDay.length > 0 && (
        <div
          className={
            compact
              ? "space-y-px"
              : "rounded-lg border border-indigo-100 bg-indigo-50/40 p-1.5 dark:border-indigo-900/30 dark:bg-indigo-950/10"
          }
        >
          {!compact && (
            <p className="px-2 pt-0.5 pb-1 text-[9px] font-bold tracking-wider text-indigo-500 uppercase dark:text-indigo-300">
              All day
            </p>
          )}
          {allDay.map(renderEvent)}
        </div>
      )}
      {timed.length > 0 && (
        <div className={compact ? "space-y-px" : "space-y-0.5"}>{timed.map(renderEvent)}</div>
      )}
      {overflow > 0 && (
        <span className="block px-1 text-[9px] font-semibold text-indigo-600 dark:text-indigo-300">
          +{overflow} more event{overflow === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}
