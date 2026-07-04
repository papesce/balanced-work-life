"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatDayLabel, offsetDate } from "./plannerUtils";

interface DateNavProps {
  activeDate: string;
  today: string;
  showDateInput: boolean;
  onShowDateInput: (v: boolean) => void;
  onChangeDate: (d: string) => void;
  onGoToday: () => void;
}

export function DateNav({ activeDate, today, showDateInput, onShowDateInput, onChangeDate, onGoToday }: DateNavProps) {
  const label = formatDayLabel(activeDate, today);
  const isToday = activeDate === today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChangeDate(offsetDate(activeDate, -1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
      >
        <ChevronLeft size={15} />
      </button>

      {showDateInput ? (
        <input
          type="date"
          defaultValue={activeDate}
          autoFocus
          onChange={(e) => {
            if (e.target.value) {
              onChangeDate(e.target.value);
              onShowDateInput(false);
            }
          }}
          onBlur={() => onShowDateInput(false)}
          className="text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      ) : (
        <button
          onClick={() => onShowDateInput(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
        >
          <CalendarDays size={13} className="text-gray-400" />
          {label}
        </button>
      )}

      <button
        onClick={() => onChangeDate(offsetDate(activeDate, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
      >
        <ChevronRight size={15} />
      </button>

      {!isToday && (
        <button
          onClick={onGoToday}
          className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all cursor-pointer"
        >
          Today
        </button>
      )}
    </div>
  );
}
