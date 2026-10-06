"use client";

import { useState } from "react";
import { CalendarCog, ChevronDown, ChevronRight } from "lucide-react";
import { computeStatusUpdates } from "@/lib/tasks/statusTransition";
import {
  computeCompletedAtCorrection,
  computeSetDateCorrection,
} from "@/lib/tasks/dateCorrections";
import type { Idea, IdeaStatus } from "@/lib/types";

const STATUSES: IdeaStatus[] = [
  "draft",
  "planned",
  "scheduled",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
  "missed",
  "deferred",
  "archived",
];

/** ISO (or null) -> datetime-local value. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Corrections for wrong dates. "Set date" semantics: writes scheduled_date
 * / completed_at directly without appending to attempt_dates. Past dates
 * are allowed here; the reschedule-open-task flow (TaskRowMenu) is the
 * only place restricted to today and later.
 */
export function DateCorrectionSection({
  idea,
  onUpdate,
}: {
  idea: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const summary = [
    idea.scheduled_date ?? "No date",
    idea.status,
    idea.completed_at ? `done ${idea.completed_at.slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-4 rounded-lg border border-black/5 dark:border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
      >
        <CalendarCog size={14} className="text-indigo-500" />
        <span className="flex-1">Dates & status</span>
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
        <div className="space-y-3 border-t border-black/5 px-3 py-2 dark:border-white/5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Scheduled date (correction, keeps history)
            </span>
            <span className="flex gap-2">
              <input
                type="date"
                value={idea.scheduled_date ?? ""}
                onChange={(e) =>
                  void onUpdate(idea.id, computeSetDateCorrection(e.target.value || null))
                }
                className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
              />
              {idea.scheduled_date && (
                <button
                  onClick={() => void onUpdate(idea.id, computeSetDateCorrection(null))}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                >
                  Clear
                </button>
              )}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Completed at (correction)
            </span>
            <span className="flex gap-2">
              <input
                type="datetime-local"
                value={isoToLocalInput(idea.completed_at)}
                onChange={(e) => {
                  const v = e.target.value;
                  void onUpdate(
                    idea.id,
                    computeCompletedAtCorrection(v ? new Date(v).toISOString() : null),
                  );
                }}
                className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
              />
              {idea.completed_at && (
                <button
                  onClick={() => void onUpdate(idea.id, computeCompletedAtCorrection(null))}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                >
                  Clear
                </button>
              )}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-medium tracking-wide text-gray-400 uppercase">
              Status
            </span>
            <select
              value={idea.status}
              onChange={(e) =>
                void onUpdate(idea.id, computeStatusUpdates(e.target.value as IdeaStatus))
              }
              className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Corrections never add to attempt history. Changing status stamps the current time; set
            Completed at afterwards if you need a past date.
          </p>
        </div>
      )}
    </div>
  );
}
