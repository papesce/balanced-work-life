"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useCalendarData } from "@/hooks/useCalendarData";
import { MiniRing } from "./MiniRing";
import { getToday } from "@/lib/dateUtils";

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DayCalendarViewProps {
  referenceDate: string;
  flashKey?: number;
}

export function DayCalendarView({ referenceDate, flashKey = 0 }: DayCalendarViewProps) {
  const { loading, dayData, monthLabel } = useCalendarData(referenceDate);
  const today = getToday();

  const prevFlashKey = useRef(flashKey);
  useEffect(() => {
    if (prevFlashKey.current === flashKey) return;
    prevFlashKey.current = flashKey;
    const el = document.getElementById("balance-today-cell");
    if (!el) return;
    el.classList.remove("today-recenter-flash");
    void el.offsetWidth;
    el.classList.add("today-recenter-flash");
    const cleanup = () => el.classList.remove("today-recenter-flash");
    el.addEventListener("animationend", cleanup, { once: true });
  }, [flashKey]);

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
            <Link
              key={date}
              id={isToday ? "balance-today-cell" : undefined}
              href={`/?date=${date}`}
              className="flex flex-col items-center gap-0.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer p-1 -m-1"
            >
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
