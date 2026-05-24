"use client";

import { useEffect, useRef } from "react";
import { LifeArea } from "@/lib/types";

const AREAS: { value: LifeArea; label: string; color: string }[] = [
  { value: "work", label: "Work", color: "text-blue-700" },
  { value: "life", label: "Life", color: "text-green-700" },
  { value: "health", label: "Health", color: "text-red-700" },
  { value: "relationships", label: "Relationships", color: "text-pink-700" },
  { value: "growth", label: "Growth", color: "text-amber-700" },
  { value: "finances", label: "Finances", color: "text-emerald-700" },
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
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]"
    >
      {AREAS.map(({ value, label, color }) => (
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
