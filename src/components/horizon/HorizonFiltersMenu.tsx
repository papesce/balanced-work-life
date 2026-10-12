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

interface HorizonFiltersMenuProps {
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  hideUpcoming: boolean;
  onToggleHideUpcoming: () => void;
  hideOverdue: boolean;
  onToggleHideOverdue: () => void;
  hideProjectsWithTasks: boolean;
  onToggleHideProjectsWithTasks: () => void;
}

/**
 * Groups the Horizon's display (hide) toggles behind a single Filters
 * menu in the header, following the TypeFilterPicker dropdown pattern.
 */
export function HorizonFiltersMenu({
  hideClosed,
  onToggleHideClosed,
  hideUpcoming,
  onToggleHideUpcoming,
  hideOverdue,
  onToggleHideOverdue,
  hideProjectsWithTasks,
  onToggleHideProjectsWithTasks,
}: HorizonFiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingAnchor | null>(null);

  const rows: FilterRow[] = [
    {
      key: "closed",
      label: "Hide closed",
      description: "Hide completed, cancelled, missed and archived items",
      checked: hideClosed,
      onToggle: onToggleHideClosed,
    },
    {
      key: "upcoming",
      label: "Hide upcoming",
      description: "Hide tasks dated today or later, plus in-progress work",
      checked: hideUpcoming,
      onToggle: onToggleHideUpcoming,
    },
    {
      key: "overdue",
      label: "Hide overdue",
      description: "Hide past-due tasks; off surfaces them for rescheduling",
      checked: hideOverdue,
      onToggle: onToggleHideOverdue,
    },
    {
      key: "projects",
      label: "Hide projects with visible tasks",
      description: "Tasks show on their own with the project breadcrumb",
      checked: hideProjectsWithTasks,
      onToggle: onToggleHideProjectsWithTasks,
    },
  ];

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
        className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
      >
        <SlidersHorizontal size={12} />
        <span className="hidden sm:inline">Filters</span>
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
