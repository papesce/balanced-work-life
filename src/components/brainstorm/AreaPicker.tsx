"use client";

import { useEffect, useRef } from "react";
import { LifeArea } from "@/lib/types";

const AREAS: { value: LifeArea; label: string; color: string }[] = [
  { value: "work", label: "Work", color: "text-blue-700 dark:text-blue-300" },
  { value: "life", label: "Life", color: "text-green-700 dark:text-green-300" },
  { value: "health", label: "Health", color: "text-red-700 dark:text-red-300" },
  { value: "relationships", label: "Relationships", color: "text-pink-700 dark:text-pink-300" },
  { value: "growth", label: "Growth", color: "text-amber-700 dark:text-amber-300" },
  { value: "finances", label: "Finances", color: "text-emerald-700 dark:text-emerald-300" },
];

interface AreaPickerProps {
  current: LifeArea | null;
  onSelect: (area: LifeArea | null) => void;
  onClose: () => void;
}

export function AreaPicker({ current, onSelect, onClose }: AreaPickerProps) {
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
      className="absolute right-0 top-full mt-1 z-50 glass-card-strong rounded-xl py-1 min-w-[140px] shadow-lg"
    >
      {AREAS.map(({ value, label, color }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`block w-full text-left text-sm px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] ${
            current === value ? "font-medium" : ""
          } ${color}`}
        >
          {label}
        </button>
      ))}
      {current && (
        <button
          onClick={() => onSelect(null)}
          className="block w-full text-left text-sm px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] text-gray-400 dark:text-gray-500 italic border-t border-black/5 dark:border-white/5 mt-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
