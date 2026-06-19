"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, Check, X } from "lucide-react";
import { IdeaStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: IdeaStatus; label: string; icon: React.ElementType | null; color: string; bg: string }[] = [
  { value: "planned",    label: "Planned",    icon: null,  color: "text-sky-600 dark:text-sky-400",     bg: "bg-sky-50 dark:bg-sky-950/20" },
  { value: "scheduled",  label: "Scheduled",  icon: null,  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/20" },
  { value: "in_progress", label: "In Progress", icon: Play, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { value: "paused",      label: "Paused",    icon: Pause, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20" },
  { value: "completed",   label: "Completed", icon: Check, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/20" },
  { value: "cancelled",   label: "Cancelled", icon: X,     color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/20" },
];

interface StatusPickerProps {
  current: IdeaStatus;
  onSelect: (status: IdeaStatus) => void;
  onClose: () => void;
}

export function StatusPicker({ current, onSelect, onClose }: StatusPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 glass-card-strong rounded-xl py-1 min-w-[150px] shadow-lg"
    >
      {STATUS_OPTIONS.map(({ value, label, icon: Icon, color, bg }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${isActive ? bg + " " + color : color}`}
          >
            {Icon && (
              <span className="w-4 h-4 flex items-center justify-center">
                <Icon size={12} strokeWidth={2.5} />
              </span>
            )}
            {!Icon && <span className="w-4" />}
            <span>{label}</span>
            {isActive && <span className="ml-auto text-[9px] opacity-50">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
