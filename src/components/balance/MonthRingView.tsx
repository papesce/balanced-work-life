"use client";

import { useBalanceData } from "@/hooks/useBalanceData";
import { MiniRing } from "./MiniRing";
import { getToday, toLocalDateString } from "@/lib/dateUtils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthRingViewProps {
  referenceDate: string;
}

export function MonthRingView({ referenceDate }: MonthRingViewProps) {
  const { loading, buckets } = useBalanceData("year", referenceDate);
  const today = getToday();
  const ref = new Date(referenceDate + "T00:00:00");
  const currentYear = ref.getFullYear();
  const todayDate = new Date(today + "T00:00:00");
  const currentMonthIndex = todayDate.getFullYear() === currentYear ? todayDate.getMonth() : -1;

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center rounded-[20px] px-5 py-8">
        <div className="animate-pulse text-sm text-gray-400 dark:text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-4 py-5">
      <h2 className="mb-5 text-center text-sm font-semibold text-gray-700 dark:text-gray-200">
        {currentYear}
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {MONTH_LABELS.map((label, i) => {
          const bucket = buckets[i];
          const counts = bucket?.counts ?? {
            work: 0,
            health: 0,
            relationships: 0,
            growth: 0,
            finances: 0,
            life: 0,
          };
          const isCurrent = i === currentMonthIndex;
          const monthStart = toLocalDateString(new Date(currentYear, i, 1));
          const isFuture = monthStart > today;

          return (
            <div
              key={label}
              className={[
                "flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors",
                isCurrent
                  ? "bg-violet-500/10 ring-1 ring-violet-400/30 dark:bg-violet-400/10"
                  : "bg-black/[0.02] dark:bg-white/[0.03]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-xs font-semibold",
                  isCurrent
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-gray-500 dark:text-gray-400",
                ].join(" ")}
              >
                {label}
              </span>
              <MiniRing counts={counts} size={64} showTotal dimmed={isFuture} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
