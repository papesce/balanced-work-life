"use client";

import { useEffect, useRef } from "react";
import { getToday, toLocalDateString } from "@/lib/dateUtils";

interface SchedulePickerProps {
  currentDate: string | null;
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function getTodayString(): string {
  return getToday();
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

function getNextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  today.setDate(today.getDate() + daysUntilMonday);
  return toLocalDateString(today);
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
      className="glass-card-strong absolute top-full right-0 z-50 mt-1 w-56 space-y-1 rounded-xl p-2"
    >
      <button
        onClick={() => onSelect(today)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
      >
        <span>Hoy</span>
        <span className="font-mono text-[10px] text-gray-400 uppercase dark:text-gray-500">
          {formatDate(today)}
        </span>
      </button>
      <button
        onClick={() => onSelect(tomorrow)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
      >
        <span>Mañana</span>
        <span className="font-mono text-[10px] text-gray-400 uppercase dark:text-gray-500">
          {formatDate(tomorrow)}
        </span>
      </button>
      <button
        onClick={() => onSelect(nextMonday)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
      >
        <span>Lunes</span>
        <span className="font-mono text-[10px] text-gray-400 uppercase dark:text-gray-500">
          {formatDate(nextMonday)}
        </span>
      </button>
      <input
        type="date"
        value={currentDate ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="w-full rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/80 focus:ring-1 focus:ring-violet-500/40 focus:outline-none dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800/80"
      />
      {currentDate && (
        <button
          onClick={onClear}
          className="w-full rounded-md px-3 py-1.5 text-left text-sm text-red-600 hover:bg-black/[0.03] dark:text-red-400 dark:hover:bg-white/[0.06]"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
