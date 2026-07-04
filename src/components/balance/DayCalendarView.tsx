"use client";

import { useCalendarData } from "@/hooks/useCalendarData";
import { MiniRing } from "./MiniRing";
import { getToday } from "@/lib/dateUtils";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DayCalendarViewProps {
  referenceDate: string;
}

export function DayCalendarView({ referenceDate }: DayCalendarViewProps) {
  const { loading, dayData, monthLabel } = useCalendarData(referenceDate);
  const today = getToday();

  if (loading) {
    return (
      <div className="glass-card rounded-[20px] px-5 py-8 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-4 py-5">
      <h2 className="text-sm font-semibold text-center text-gray-700 dark:text-gray-200 mb-4">
        {monthLabel}
      </h2>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-2">
        {dayData.map(({ date, counts, isCurrentMonth }) => {
          const dayNum = parseInt(date.slice(8), 10);
          const isToday = date === today;
          const isFuture = date > today;
          const dimmed = !isCurrentMonth || isFuture;

          return (
            <div key={date} className="flex flex-col items-center gap-0.5">
              <span
                className={[
                  "text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                  isToday
                    ? "bg-violet-500 text-white"
                    : isCurrentMonth
                    ? "text-gray-700 dark:text-gray-300"
                    : "text-gray-300 dark:text-gray-600",
                ].join(" ")}
              >
                {dayNum}
              </span>
              <MiniRing counts={counts} size={34} dimmed={dimmed} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
