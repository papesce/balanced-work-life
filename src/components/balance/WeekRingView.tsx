"use client";

import { useWeekData } from "@/hooks/useWeekData";
import { LifeArea } from "@/lib/types";
import { getToday, getWindowRange } from "@/lib/dateUtils";
import { MiniRing } from "./MiniRing";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";

interface WeekRingViewProps {
  referenceDate: string;
}

export function WeekRingView({ referenceDate }: WeekRingViewProps) {
  const { loading, weeks } = useWeekData(referenceDate);
  const currentMondayStr = getWindowRange("week", getToday()).start;

  if (loading) {
    return (
      <div className="glass-card rounded-[20px] px-5 py-8 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-4 py-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Weekly Balance
      </h2>
      <div className="space-y-3">
        {weeks.map((w) => {
          const total = Object.values(w.counts).reduce((s, c) => s + c, 0);
          const activeAreas = (AREA_ORDER as LifeArea[]).filter((a) => w.counts[a] > 0);
          const isCurrent = w.start === currentMondayStr;
          return (
            <div
              key={w.start}
              className={[
                "flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors",
                isCurrent
                  ? "bg-violet-500/10 dark:bg-violet-400/10 ring-1 ring-violet-400/30"
                  : "bg-black/[0.02] dark:bg-white/[0.03]",
              ].join(" ")}
            >
              <MiniRing counts={w.counts} size={72} showTotal />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {w.label}
                </div>
                {total === 0 ? (
                  <div className="text-xs text-gray-400 dark:text-gray-500">No tasks</div>
                ) : (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {activeAreas.map((area) => (
                      <div key={area} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: areaColors[area]?.dot }}
                        />
                        {AREA_LABELS[area]} {w.counts[area]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
