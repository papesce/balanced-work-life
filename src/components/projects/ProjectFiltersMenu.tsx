"use client";

import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

interface FilterRow {
  key: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

interface ProjectFiltersMenuProps {
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  hideCompleted: boolean;
  onToggleHideCompleted: () => void;
}

/**
 * Project detail display (hide) toggles behind a single Filters menu,
 * following the HorizonFiltersMenu pattern.
 */
export function ProjectFiltersMenu({
  hideClosed,
  onToggleHideClosed,
  hideCompleted,
  onToggleHideCompleted,
}: ProjectFiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingAnchor | null>(null);

  const rows: FilterRow[] = [
    {
      key: "closed",
      label: "Hide closed",
      description: "Hide completed, cancelled, missed and archived tasks",
      checked: hideClosed,
      onToggle: onToggleHideClosed,
    },
    {
      key: "completed",
      label: "Hide completed",
      description: "Hide only completed; show cancelled for triage",
      checked: hideCompleted,
      onToggle: onToggleHideCompleted,
    },
  ];

  const active = hideClosed || hideCompleted;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(true);
        }}
        aria-expanded={open}
        title="Display filters"
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-indigo-300 bg-white text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
            : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
        }`}
      >
        <SlidersHorizontal size={12} />
        <span className="hidden sm:inline">Filters</span>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />}
      </button>
      {open && pos && (
        <FloatingPanel
          anchor={pos}
          onClose={() => setOpen(false)}
          className="glass-card-strong min-w-[240px] rounded-xl border border-black/5 py-1.5 shadow-xl dark:border-white/5"
        >
          <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Display
          </div>
          {rows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={row.onToggle}
              aria-pressed={row.checked}
              className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              <span
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  row.checked
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
                }`}
              >
                {row.checked && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {row.label}
                </span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                  {row.description}
                </span>
              </span>
            </button>
          ))}
        </FloatingPanel>
      )}
    </div>
  );
}
