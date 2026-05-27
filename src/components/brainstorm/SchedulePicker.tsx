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

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-2 space-y-1"
    >
      <button
        onClick={() => onSelect(today)}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-100"
      >
        Hoy
      </button>
      <button
        onClick={() => onSelect(addDays(today, 1))}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-100"
      >
        Mañana
      </button>
      <button
        onClick={() => onSelect(getNextMonday())}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-100"
      >
        Lunes
      </button>
      <input
        type="date"
        value={currentDate ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="w-full px-3 py-1.5 text-sm text-gray-700 rounded-md border border-gray-200 hover:bg-gray-100 focus:outline-none"
      />
      {currentDate && (
        <button
          onClick={onClear}
          className="w-full text-left px-3 py-1.5 text-sm text-red-600 rounded-md hover:bg-gray-100"
        >
          Quitar
        </button>
      )}
    </div>
  );
}
