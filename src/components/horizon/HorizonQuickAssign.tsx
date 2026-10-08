"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { addDays, getToday } from "@/lib/dateUtils";
import { computeQuickAssignPatch } from "@/lib/tasks/dateCorrections";
import type { Idea } from "@/lib/types";
import { FloatingPanel } from "@/components/shared/FloatingPanel";

/**
 * One-tap date assign for Horizon rows/cards. Chips assign immediately with
 * a single onUpdate write (no Brainstorm trip, no reschedule modal):
 * past date → done on that date, today/later → scheduled. The Done checkbox
 * overrides the default once touched (shows "Auto" until then).
 */
export function HorizonQuickAssign({
  node,
  onUpdate,
}: {
  node: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [markDoneOverride, setMarkDoneOverride] = useState<boolean | null>(null);

  const today = getToday();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  const assign = (date: string) => {
    const patch =
      markDoneOverride === null
        ? computeQuickAssignPatch(date, { today })
        : computeQuickAssignPatch(date, { today, markDone: markDoneOverride });
    void onUpdate(node.id, patch);
    setOpen(false);
    setMarkDoneOverride(null);
  };

  const label = node.scheduled_date
    ? new Date(node.scheduled_date + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Set date";

  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPanelPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(!open);
        }}
        title={node.scheduled_date ? `Scheduled: ${node.scheduled_date}` : "Quick assign date"}
        className={`flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-semibold whitespace-nowrap transition-opacity hover:opacity-80 ${
          node.scheduled_date
            ? "border-indigo-200 text-indigo-600 dark:border-indigo-500/30 dark:text-indigo-300"
            : "border-dashed border-gray-300 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 dark:border-gray-600 dark:hover:text-gray-300"
        }`}
      >
        <CalendarPlus size={11} strokeWidth={2} />
        {label}
      </button>
      {open && panelPos && (
        <FloatingPanel
          anchor={panelPos}
          onClose={() => setOpen(false)}
          className="glass-card-strong w-44 space-y-1 rounded-xl p-2"
        >
          {(
            [
              { label: "Yesterday", date: yesterday },
              { label: "Today", date: today },
              { label: "Tomorrow", date: tomorrow },
            ] as const
          ).map((chip) => (
            <button
              key={chip.label}
              onClick={() => assign(chip.date)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <span>{chip.label}</span>
              <span className="font-mono text-[10px] text-gray-400">
                {chip.date.slice(5).replace("-", "/")}
              </span>
            </button>
          ))}
          <label
            htmlFor={`qa-pick-${node.id}`}
            className="block px-2 pt-1 text-[10px] font-medium text-gray-400 dark:text-gray-500"
          >
            Pick…
          </label>
          <input
            id={`qa-pick-${node.id}`}
            type="date"
            aria-label="Pick a date"
            className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
            onChange={(e) => {
              if (e.target.value) assign(e.target.value);
            }}
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={markDoneOverride ?? false}
              onChange={(e) => setMarkDoneOverride(e.target.checked)}
              className="accent-violet-600"
            />
            Done
            {markDoneOverride === null && (
              <span className="text-[10px] font-normal text-gray-400">(auto: past = done)</span>
            )}
          </label>
        </FloatingPanel>
      )}
    </div>
  );
}
