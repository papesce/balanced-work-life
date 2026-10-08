"use client";

import { useEffect, useRef } from "react";
import { STATUS_CONFIG } from "@/lib/constants";
import { IdeaStatus } from "@/lib/types";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

const STATUS_OPTIONS: {
  value: IdeaStatus;
  color: string;
  bg: string;
}[] = [
  {
    value: "completed",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/20",
  },
  {
    value: "in_progress",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
  },
  {
    value: "planned",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/20",
  },
  {
    value: "scheduled",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    value: "paused",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    value: "deferred",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/20",
  },
  {
    value: "cancelled",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
  {
    value: "missed",
    color: "text-rose-500 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/20",
  },
];

interface StatusPickerProps {
  current: IdeaStatus;
  onSelect: (status: IdeaStatus) => void;
  onClose: () => void;
  /**
   * When set, renders in a FloatingPanel portal (FLOATING layer) so the
   * picker paints above glass-card stacking contexts.
   */
  position?: FloatingAnchor;
}

export function StatusPicker({ current, onSelect, onClose, position }: StatusPickerProps) {
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
      {STATUS_OPTIONS.map(({ value, color, bg }) => {
        const isActive = current === value;
        const { label, icon: Icon } = STATUS_CONFIG[value];
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08] ${isActive ? bg + " " + color : color}`}
          >
            {Icon && (
              <span className="flex h-4 w-4 items-center justify-center">
                <Icon size={12} strokeWidth={2.5} />
              </span>
            )}
            {!Icon && <span className="w-4" />}
            <span>{label}</span>
            {isActive && <span className="ml-auto text-[9px] opacity-50">✓</span>}
          </button>
        );
      })}
    </>
  );

  if (position)
    return (
      <FloatingPanel
        anchor={position}
        onClose={onClose}
        className="glass-card-strong min-w-[160px] rounded-xl border border-black/5 py-1 shadow-lg dark:border-white/5"
      >
        {content}
      </FloatingPanel>
    );

  return (
    <div
      ref={ref}
      className="glass-card-strong absolute top-full left-0 z-50 mt-1 min-w-[160px] rounded-xl border border-black/5 py-1 shadow-lg dark:border-white/5"
    >
      {content}
    </div>
  );
}
