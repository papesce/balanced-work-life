"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { IdeaType } from "@/lib/types";
import { TYPE_BADGE } from "@/lib/constants";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

const TYPES: IdeaType[] = ["idea", "objective", "project", "initiative", "task"];

interface TypeFilterPickerProps {
  selected: IdeaType[];
  onToggle: (type: IdeaType) => void;
  onClear: () => void;
  onClose: () => void;
  /**
   * When set, renders in a FloatingPanel portal (FLOATING layer) so the
   * picker paints above glass-card stacking contexts.
   */
  position?: FloatingAnchor;
}

export function TypeFilterPicker({
  selected,
  onToggle,
  onClear,
  onClose,
  position,
}: TypeFilterPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // FloatingPanel owns outside-click/Escape/scroll handling when portaled.
    if (position) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, position]);

  const content = (
    <>
      <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
        Filter by type
      </div>
      {TYPES.map((type) => {
        const badge = TYPE_BADGE[type];
        const isSelected = selected.includes(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-black/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.04]"
          >
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                isSelected
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
              }`}
            >
              {isSelected && <Check size={10} strokeWidth={3} />}
            </span>
            <span className={badge.className}>{badge.label}</span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="mt-1 flex w-full items-center border-t border-black/5 px-2.5 py-1.5 text-left text-xs font-semibold text-gray-400 italic hover:bg-black/[0.03] dark:border-white/5 dark:text-gray-500 dark:hover:bg-white/[0.04]"
        >
          Clear
        </button>
      )}
    </>
  );

  if (position)
    return (
      <FloatingPanel
        anchor={position}
        onClose={onClose}
        className="glass-card-strong min-w-[160px] rounded-xl border border-black/5 py-1.5 shadow-xl dark:border-white/5"
      >
        {content}
      </FloatingPanel>
    );

  return (
    <div
      ref={ref}
      className="glass-card-strong absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-xl border border-black/5 py-1.5 shadow-xl dark:border-white/5"
    >
      {content}
    </div>
  );
}
