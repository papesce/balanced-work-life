"use client";

import { useEffect, useRef } from "react";

interface SchedulePickerProps {
  currentDate: string | null;
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getNextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  today.setDate(today.getDate() + daysUntilMonday);
  return today.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function SchedulePicker({ currentDate, onSelect, onClear, onClose }: SchedulePickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const today = getTodayString();
  const tomorrow = addDays(today, 1);
  const nextMonday = getNextMonday();

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-56 glass-card-strong rounded-xl p-2 space-y-1"
    >
      <button
        onClick={() => onSelect(today)}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex justify-between items-center"
      >
        <span>Hoy</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase">{formatDate(today)}</span>
      </button>
      <button
        onClick={() => onSelect(tomorrow)}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex justify-between items-center"
      >
        <span>Mañana</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase">{formatDate(tomorrow)}</span>
      </button>
      <button
        onClick={() => onSelect(nextMonday)}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.06] flex justify-between items-center"
      >
        <span>Lunes</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono uppercase">{formatDate(nextMonday)}</span>
      </button>
      <input
        type="date"
        value={currentDate ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
      />
      {currentDate && (
        <button
          onClick={onClear}
          className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
