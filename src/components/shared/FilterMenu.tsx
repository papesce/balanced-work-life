"use client";

import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

export interface FilterOption {
  key: string;
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}

interface FilterMenuProps {
  title?: string;
  options: FilterOption[];
  buttonLabel?: string;
}

/**
 * A reusable filter dropdown menu that uses a FloatingPanel for its content.
 * Follows the pattern used in the Horizon view for a consistent, polished UI.
 */
export function FilterMenu({
  title = "Display",
  options,
  buttonLabel = "Filters",
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<FloatingAnchor | null>(null);

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
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>
      {open && pos && (
        <FloatingPanel
          anchor={pos}
          onClose={() => setOpen(false)}
          className="glass-card-strong min-w-[240px] rounded-xl border border-black/5 py-1.5 shadow-xl dark:border-white/5"
        >
          <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            {title}
          </div>
          {options.map((row) => (
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
                {row.description && (
                  <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                    {row.description}
                  </span>
                )}
              </span>
            </button>
          ))}
        </FloatingPanel>
      )}
    </div>
  );
}
