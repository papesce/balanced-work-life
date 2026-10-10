"use client";

import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

interface FilterRow {
  key: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

interface HorizonFiltersMenuProps {
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  hideCommitted: boolean;
  onToggleHideCommitted: () => void;
  /** True when the active lens always shows committed work (e.g. "Ready to move"). */
  committedLocked: boolean;
  committedLockedHint: string;
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
  hideCommitted,
  onToggleHideCommitted,
  committedLocked,
  committedLockedHint,
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
      key: "committed",
      label: "Hide committed",
      description: committedLocked
        ? committedLockedHint
        : "Hide scheduled, in-progress and dated items",
      checked: hideCommitted,
      disabled: committedLocked,
      onToggle: onToggleHideCommitted,
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
              disabled={row.disabled}
              aria-pressed={row.checked}
              title={row.disabled ? row.description : undefined}
              className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left ${
                row.disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
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
