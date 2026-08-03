"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Idea } from "@/lib/types";
import {
  RescheduleAction,
  tomorrowAction,
  nextWeekAction,
} from "@/lib/tasks/rescheduleTask";

interface TriageActionsProps {
  task: Idea;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  compact?: boolean;
}

const COLORS = {
  complete:
    "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
  today:
    "text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20",
  date:
    "text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20",
  defer:
    "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/20",
  cancel:
    "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20",
};

export function TriageActions({
  task,
  onReschedule,
  onComplete,
  onCancel,
  compact = false,
}: TriageActionsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const base = compact
    ? "text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
    : "text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer";

  return (
    <div className="flex items-center gap-1.5 self-end flex-wrap">
      <button
        onClick={() => void onComplete(task.id)}
        className={`${base} ${COLORS.complete} flex items-center gap-1`}
      >
        <Check size={compact ? 10 : 11} />
        Complete
      </button>
      <button
        onClick={() => void onReschedule(task.id, { type: "retry_today" })}
        className={`${base} ${COLORS.today}`}
      >
        Today
      </button>
      <button
        onClick={() => void onReschedule(task.id, tomorrowAction())}
        className={`${base} ${COLORS.today}`}
      >
        Tomorrow
      </button>
      <button
        onClick={() => void onReschedule(task.id, nextWeekAction())}
        className={`${base} ${COLORS.today}`}
      >
        Next week
      </button>
      <div className="relative">
        <button
          onClick={() => setShowDatePicker((v) => !v)}
          className={`${base} ${COLORS.date}`}
        >
          Reschedule
        </button>
        {showDatePicker && (
          <input
            type="date"
            autoFocus
            className="absolute right-0 top-full mt-1 text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 z-50"
            onChange={(e) => {
              if (e.target.value) void onReschedule(task.id, { type: "reschedule", newDate: e.target.value });
              setShowDatePicker(false);
            }}
            onBlur={() => setShowDatePicker(false)}
          />
        )}
      </div>
      <button
        onClick={() => void onReschedule(task.id, { type: "defer" })}
        className={`${base} ${COLORS.defer}`}
      >
        No date
      </button>
      <button
        onClick={() => void onCancel(task.id)}
        className={`${base} ${COLORS.cancel} flex items-center gap-1`}
      >
        <X size={compact ? 9 : 10} />
        Cancel
      </button>
    </div>
  );
}
