"use client";

import { useRef } from "react";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import type { PlannerRowState } from "@/hooks/usePlannerRowState";
import type { Idea } from "@/lib/types";

export function RowStatusPill({
  task,
  isCompleted,
  isCancelled,
  isMissed,
  isPaused,
  isInProgress,
  statusLabel,
  ui,
}: {
  task: Idea;
  isCompleted: boolean;
  isCancelled: boolean;
  isMissed: boolean;
  isPaused: boolean;
  isInProgress: boolean;
  statusLabel: string;
  ui: PlannerRowState;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex-shrink-0">
      <button
        ref={triggerRef}
        onClick={() => {
          if (ui.showStatusPicker) {
            ui.setShowStatusPicker(false);
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) ui.setStatusPickerPos({ top: rect.bottom + 6, left: rect.left });
          ui.setShowStatusPicker(true);
        }}
        className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all hover:opacity-80"
        style={{
          background: isCompleted
            ? "#f5f3ff"
            : isCancelled
              ? "#fef2f2"
              : isMissed
                ? "#fff1f2"
                : isPaused
                  ? "#fff7ed"
                  : isInProgress
                    ? "#fefce8"
                    : "rgba(0,0,0,0.05)",
          color: isCompleted
            ? "#7c3aed"
            : isCancelled
              ? "#ef4444"
              : isMissed
                ? "#f43f5e"
                : isPaused
                  ? "#f97316"
                  : isInProgress
                    ? "#d97706"
                    : "#9ca3af",
        }}
      >
        {statusLabel}
      </button>
      {ui.showStatusPicker && ui.statusPickerPos && (
        <StatusPicker
          current={task.status}
          onSelect={ui.handleStatusSelect}
          onClose={() => ui.setShowStatusPicker(false)}
          position={ui.statusPickerPos}
        />
      )}
    </div>
  );
}
