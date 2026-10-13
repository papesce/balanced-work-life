"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import type { PlannerRowState } from "@/hooks/usePlannerRowState";
import type { Idea } from "@/lib/types";
import { formatTime } from "@/components/planner/plannerUtils";

export function DurationMenu({
  task,
  ui,
  onUpdate,
}: {
  task: Idea;
  ui: PlannerRowState;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
}) {
  const durationRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLButtonElement>(null);
  const { showDurationDropdown, setShowDurationDropdown } = ui;

  // The duration dropdown is inline (not a FloatingPanel portal), so it
  // still needs its own outside-pointer check.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (durationRef.current && !durationRef.current.contains(e.target as Node))
        setShowDurationDropdown(false);
    };
    if (showDurationDropdown) document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showDurationDropdown, setShowDurationDropdown]);

  return (
    <>
      <div className="relative" ref={durationRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            ui.setDurationPos({ top: rect.bottom + 6, left: rect.left });
            ui.setShowDurationDropdown(!ui.showDurationDropdown);
            ui.setShowCustomInput(false);
          }}
          className={`flex flex-shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
            task.duration_minutes
              ? "bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
              : "text-gray-400 hover:bg-black/5 md:opacity-0 md:group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-white/5"
          }`}
          title="Set task duration"
        >
          <Clock size={11} />
          {task.duration_minutes ? `${task.duration_minutes}m` : ""}
        </button>

        {ui.showDurationDropdown && ui.durationPos && (
          <FloatingPanel
            anchor={ui.durationPos}
            onClose={() => ui.setShowDurationDropdown(false)}
            className="glass-card-strong min-w-[110px] space-y-1 rounded-xl border border-black/5 p-1.5 shadow-xl dark:border-white/5"
          >
            {!ui.showCustomInput ? (
              <>
                {[15, 30, 45, 60, 90, 120].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: preset });
                      ui.setShowDurationDropdown(false);
                    }}
                    className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
                <button
                  onClick={() => ui.setShowCustomInput(true)}
                  className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-gray-400 hover:bg-black/5 dark:text-gray-500 dark:hover:bg-white/5"
                >
                  Custom...
                </button>
                {task.duration_minutes && (
                  <button
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: null });
                      ui.setShowDurationDropdown(false);
                    }}
                    className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 p-1">
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={ui.customVal}
                  placeholder="Minutes"
                  autoFocus
                  onChange={(e) => ui.setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(ui.customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      ui.setShowDurationDropdown(false);
                    }
                    if (e.key === "Escape") ui.setShowCustomInput(false);
                  }}
                  className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
                />
                <div className="mt-1 flex justify-between gap-1">
                  <button
                    onClick={() => ui.setShowCustomInput(false)}
                    className="cursor-pointer px-1 py-0.5 text-[9px] font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      const val = parseInt(ui.customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      ui.setShowDurationDropdown(false);
                    }}
                    className="cursor-pointer px-1.5 py-0.5 text-[9px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </FloatingPanel>
        )}
      </div>

      {task.scheduled_time && (
        <>
          <button
            ref={timeRef}
            onClick={(e) => {
              e.stopPropagation();
              if (ui.showTimeMenu) {
                ui.setShowTimeMenu(false);
                return;
              }
              const rect = timeRef.current?.getBoundingClientRect();
              if (rect) ui.setTimeMenuPos({ top: rect.bottom + 6, left: rect.left });
              ui.setShowTimeMenu(true);
            }}
            title="Clear time"
            className="flex-shrink-0 cursor-pointer rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-500 tabular-nums transition-colors hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            {formatTime(task.scheduled_time)}
          </button>
          {ui.showTimeMenu && ui.timeMenuPos && (
            <FloatingPanel
              anchor={ui.timeMenuPos}
              onClose={() => ui.setShowTimeMenu(false)}
              className="glass-card-strong min-w-[130px] rounded-lg border border-black/5 py-1 shadow-lg dark:border-white/5"
            >
              <button
                onClick={() => {
                  onUpdate(task.id, { scheduled_time: null });
                  ui.setShowTimeMenu(false);
                }}
                className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
              >
                Clear time
              </button>
            </FloatingPanel>
          )}
        </>
      )}
    </>
  );
}
