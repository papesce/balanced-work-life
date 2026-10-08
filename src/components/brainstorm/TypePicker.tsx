"use client";

import { useEffect, useRef } from "react";
import { IdeaType } from "@/lib/types";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

const TYPES: { value: IdeaType; label: string; color: string }[] = [
  { value: "idea", label: "Idea", color: "text-orange-700 dark:text-orange-300" },
  { value: "objective", label: "Objective", color: "text-purple-700 dark:text-purple-300" },
  { value: "project", label: "Project", color: "text-emerald-700 dark:text-emerald-300" },
  { value: "initiative", label: "Initiative", color: "text-amber-700 dark:text-amber-300" },
  { value: "task", label: "Task", color: "text-blue-700 dark:text-blue-300" },
];

interface TypePickerProps {
  current: IdeaType | null;
  onSelect: (type: IdeaType | null) => void;
  onClose: () => void;
  /**
   * When set, renders in a FloatingPanel portal (FLOATING layer) so the
   * picker paints above glass-card stacking contexts.
   */
  position?: FloatingAnchor;
}

export function TypePicker({ current, onSelect, onClose, position }: TypePickerProps) {
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
      {TYPES.map(({ value, label, color }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06] ${
            current === value ? "font-medium" : ""
          } ${color}`}
        >
          {label}
        </button>
      ))}
      {current && (
        <button
          onClick={() => onSelect(null)}
          className="mt-1 block w-full border-t border-black/5 px-3 py-1.5 text-left text-sm text-gray-400 italic hover:bg-black/[0.03] dark:border-white/5 dark:text-gray-500 dark:hover:bg-white/[0.06]"
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
        className="glass-card-strong min-w-[130px] rounded-xl py-1"
      >
        {content}
      </FloatingPanel>
    );

  return (
    <div
      ref={ref}
      className="glass-card-strong absolute top-full right-0 z-50 mt-1 min-w-[130px] rounded-xl py-1"
    >
      {content}
    </div>
  );
}
