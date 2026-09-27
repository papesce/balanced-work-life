"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import { getTriageMeta } from "@/lib/tasks/rescheduleTask";
import type { Idea } from "@/lib/types";

/** Read-only schedule-attempt history (attempt_dates + current scheduled_date). */
export function ScheduleAttempts({ idea }: { idea: Idea }) {
  const [open, setOpen] = useState(false);
  const meta = getTriageMeta(idea);
  const attempts = Array.isArray(idea.attempt_dates) ? idea.attempt_dates : [];

  const summary = idea.scheduled_date
    ? `${idea.scheduled_date} · ${meta.attemptCount} attempt${meta.attemptCount === 1 ? "" : "s"}`
    : attempts.length > 0
      ? `Unscheduled · ${meta.attemptCount} attempt${meta.attemptCount === 1 ? "" : "s"}`
      : "Not scheduled";

  return (
    <div className="mb-4 rounded-lg border border-black/5 dark:border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
      >
        <CalendarClock size={14} className="text-indigo-500" />
        <span className="flex-1">Schedule attempts</span>
        <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <span className="max-w-[220px] truncate">{summary}</span>
          {open ? (
            <ChevronDown size={12} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={12} strokeWidth={1.5} />
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-black/5 px-3 py-2 dark:border-white/5">
          {attempts.length === 0 && !idea.scheduled_date ? (
            <p className="px-2 py-1.5 text-xs text-gray-400 italic">No schedule attempts yet</p>
          ) : (
            <ol className="space-y-1">
              {attempts.map((date, i) => (
                <li
                  key={`${date}-${i}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400"
                >
                  <span className="w-4 shrink-0 text-[10px] font-semibold text-gray-400 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="tabular-nums">{date}</span>
                </li>
              ))}
              {idea.scheduled_date && (
                <li className="flex items-center gap-2 rounded bg-indigo-50/50 px-2 py-1.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <span className="w-4 shrink-0 text-[10px] tabular-nums">
                    {attempts.length + 1}
                  </span>
                  <span className="tabular-nums">{idea.scheduled_date}</span>
                  <span className="ml-auto text-[10px] font-medium">current</span>
                </li>
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
