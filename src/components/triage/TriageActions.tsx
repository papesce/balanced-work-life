"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Idea } from "@/lib/types";
import { RescheduleAction, tomorrowAction, nextWeekAction } from "@/lib/tasks/rescheduleTask";

interface TriageActionsProps {
  task: Idea;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  compact?: boolean;
}

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
    <div className="flex flex-wrap items-center gap-1.5 self-end">
      <button
        onClick={() => void onComplete(task.id)}
        className={`${base} flex items-center gap-1 text-emerald-600 hover:bg-emerald-50`}
      >
        <Check size={compact ? 10 : 11} />
        Complete
      </button>
      <button
        onClick={() => void onReschedule(task.id, { type: "retry_today" })}
        className={`${base} text-violet-600`}
      >
        Today
      </button>
      <button
        onClick={() => void onReschedule(task.id, tomorrowAction())}
        className={`${base} text-violet-600`}
      >
        Tomorrow
      </button>
      <button
        onClick={() => void onReschedule(task.id, nextWeekAction())}
        className={`${base} text-violet-600`}
      >
        Next week
      </button>
      <div className="relative">
        <button onClick={() => setShowDatePicker((v) => !v)} className={`${base} text-sky-600`}>
          Reschedule
        </button>
        {showDatePicker && (
          <input
            type="date"
            autoFocus
            className="absolute top-full right-0 z-50 mt-1 rounded-lg border bg-white px-2 py-1.5 text-xs"
            onChange={(e) => {
              if (e.target.value)
                void onReschedule(task.id, { type: "reschedule", newDate: e.target.value });
              setShowDatePicker(false);
            }}
            onBlur={() => setShowDatePicker(false)}
          />
        )}
      </div>
      <button
        onClick={() => void onReschedule(task.id, { type: "defer" })}
        className={`${base} text-gray-400`}
      >
        No date
      </button>
      <button
        onClick={() => void onCancel(task.id)}
        className={`${base} flex items-center gap-1 text-red-500`}
      >
        <X size={compact ? 9 : 10} />
        Cancel
      </button>
    </div>
  );
}
