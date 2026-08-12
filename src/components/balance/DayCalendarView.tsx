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
      <div className="glass-card flex items-center justify-center rounded-[20px] px-5 py-8">
        <div className="animate-pulse text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-4 py-5">
      <h2 className="mb-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
        {monthLabel}
      </h2>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-medium text-gray-400 dark:text-gray-500"
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
              className="-m-1 flex cursor-pointer flex-col items-center gap-0.5 rounded-lg p-1 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              <span
                className={[
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
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
