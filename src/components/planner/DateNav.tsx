"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatDayLabel, offsetDate } from "./plannerUtils";

interface DateNavProps {
  activeDate: string;
  today: string;
  showDateInput: boolean;
  onShowDateInput: (v: boolean) => void;
  onChangeDate: (d: string) => void;
}

const segButton = "flex items-center justify-center h-full px-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer";
const divider = "w-px h-4 bg-black/[0.06] dark:bg-white/[0.08]";

export function DateNav({ activeDate, today, showDateInput, onShowDateInput, onChangeDate }: DateNavProps) {
  const label = formatDayLabel(activeDate, today);
  const isToday = activeDate === today;

  return (
    <div className="flex items-center gap-2">
      {!isToday && (
        <button
          type="button"
          onClick={() => onChangeDate(today)}
          className="toolbar-btn toolbar-btn--accent hidden md:inline-flex mr-1"
        >
          Today
        </button>
      )}

      <div className="flex items-center h-8 rounded-lg bg-white/70 dark:bg-gray-900/60 border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => onChangeDate(offsetDate(activeDate, -1))}
          aria-label="Previous day"
          className={segButton}
        >
          <ChevronLeft size={15} />
        </button>
        <div className={divider} />

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
            className="text-xs border-0 bg-transparent px-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => onShowDateInput(true)}
            className={`${segButton} min-w-[96px] text-xs font-semibold`}
          >
            <CalendarDays size={13} className="text-gray-400 dark:text-gray-500 mr-1" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        )}
        <div className={divider} />

        <button
          type="button"
          onClick={() => onChangeDate(offsetDate(activeDate, 1))}
          aria-label="Next day"
          className={segButton}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
