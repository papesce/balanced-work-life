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

export function TriageActions({ task, onReschedule, onComplete, onCancel, compact = false }: TriageActionsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const base = compact
    ? "text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
    : "text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer";
  return (
    <div className="flex items-center gap-1.5 self-end flex-wrap">
      <button onClick={() => void onComplete(task.id)} className={`${base} text-emerald-600 hover:bg-emerald-50 flex items-center gap-1`}><Check size={compact ? 10 : 11} />Complete</button>
      <button onClick={() => void onReschedule(task.id, { type: "retry_today" })} className={`${base} text-violet-600`}>Today</button>
      <button onClick={() => void onReschedule(task.id, tomorrowAction())} className={`${base} text-violet-600`}>Tomorrow</button>
      <button onClick={() => void onReschedule(task.id, nextWeekAction())} className={`${base} text-violet-600`}>Next week</button>
      <div className="relative">
        <button onClick={() => setShowDatePicker((v) => !v)} className={`${base} text-sky-600`}>Reschedule</button>
        {showDatePicker && <input type="date" autoFocus className="absolute right-0 top-full mt-1 text-xs border rounded-lg px-2 py-1.5 bg-white z-50" onChange={(e) => { if (e.target.value) void onReschedule(task.id, { type: "reschedule", newDate: e.target.value }); setShowDatePicker(false); }} onBlur={() => setShowDatePicker(false)} />}
      </div>
      <button onClick={() => void onReschedule(task.id, { type: "defer" })} className={`${base} text-gray-400`}>No date</button>
      <button onClick={() => void onCancel(task.id)} className={`${base} text-red-500 flex items-center gap-1`}><X size={compact ? 9 : 10} />Cancel</button>
    </div>
  );
}
