"use client";

import { useEffect, useRef } from "react";
import { IdeaType } from "@/lib/types";

const TYPES: { value: IdeaType; label: string; color: string }[] = [
  { value: "idea", label: "Idea", color: "text-orange-700" },
  { value: "objective", label: "Objective", color: "text-purple-700" },
  { value: "project", label: "Project", color: "text-emerald-700" },
  { value: "initiative", label: "Initiative", color: "text-amber-700" },
  { value: "task", label: "Task", color: "text-blue-700" },
];

interface TypePickerProps {
  current: IdeaType | null;
  onSelect: (type: IdeaType | null) => void;
  onClose: () => void;
}

export function TypePicker({ current, onSelect, onClose }: TypePickerProps) {
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
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]"
    >
      {TYPES.map(({ value, label, color }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`block w-full text-left text-sm px-3 py-1.5 hover:bg-gray-50 ${
            current === value ? "font-medium" : ""
          } ${color}`}
        >
          {label}
        </button>
      ))}
      {current && (
        <button
          onClick={() => onSelect(null)}
          className="block w-full text-left text-sm px-3 py-1.5 hover:bg-gray-50 text-gray-400 italic border-t border-gray-100 mt-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
