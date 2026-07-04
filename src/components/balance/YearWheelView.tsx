"use client";

import { useBalanceData } from "@/hooks/useBalanceData";
import { MiniRing } from "./MiniRing";
import { LifeArea } from "@/lib/types";
import { AREA_ORDER, DEFAULT_TARGETS, LOCAL_STORAGE_TARGETS_KEY } from "@/components/planner/constants";

const AREA_COLORS: Record<LifeArea, string> = {
  work: "#4F6BED",
  health: "#EF4444",
  relationships: "#EC4899",
  growth: "#F59E0B",
  finances: "#10B981",
  life: "#8B5CF6",
};

const AREA_LABELS: Record<LifeArea, string> = {
  work: "Work",
  health: "Health",
  relationships: "Relationships",
  growth: "Growth",
  finances: "Finances",
  life: "Life",
};

function loadTargets(): Record<LifeArea, number> {
  if (typeof window === "undefined") return DEFAULT_TARGETS;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_TARGETS_KEY);
    if (stored) return JSON.parse(stored) as Record<LifeArea, number>;
  } catch {}
  return DEFAULT_TARGETS;
}

interface YearWheelViewProps {
  referenceDate: string;
}

export function YearWheelView({ referenceDate }: YearWheelViewProps) {
  const { loading, radarData, buckets } = useBalanceData("year", referenceDate);
  const ref = new Date(referenceDate + "T00:00:00");
  const year = ref.getFullYear();
  const targets = loadTargets();

  // Aggregate all monthly buckets into year totals
  const yearCounts: Record<LifeArea, number> = {
    work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0,
  };
  for (const bucket of buckets) {
    for (const area of AREA_ORDER as LifeArea[]) {
      yearCounts[area] += bucket.counts[area] ?? 0;
    }
  }
  const yearTotal = Object.values(yearCounts).reduce((s, c) => s + c, 0);

  if (loading) {
    return (
      <div className="glass-card rounded-[20px] px-5 py-8 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[20px] px-5 py-6 space-y-6">
      <h2 className="text-sm font-semibold text-center text-gray-700 dark:text-gray-200">
        Wheel of Life — {year}
      </h2>

      <div className="flex justify-center">
        <div className="relative">
          <MiniRing counts={yearCounts} size={180} strokeWidth={22} showTotal />
          {yearTotal === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl text-gray-300 dark:text-gray-600">—</span>
            </div>
          )}
        </div>
      </div>

      {/* Area legend with actual vs target */}
      <div className="space-y-2">
        {(AREA_ORDER as LifeArea[]).map((area) => {
          const actual = yearTotal > 0 ? Math.round((yearCounts[area] / yearTotal) * 100) : 0;
          const target = targets[area] ?? DEFAULT_TARGETS[area];
          const diff = actual - target;
          const barActual = Math.min(actual, 100);
          const barTarget = Math.min(target, 100);

          return (
            <div key={area} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: AREA_COLORS[area] }}
                  />
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {AREA_LABELS[area]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <span>{actual}%</span>
                  <span className="text-gray-300 dark:text-gray-600">/ {target}%</span>
                  {diff !== 0 && (
                    <span
                      className={[
                        "font-medium",
                        diff > 0
                          ? "text-emerald-500"
                          : "text-rose-400",
                      ].join(" ")}
                    >
                      {diff > 0 ? `+${diff}` : diff}%
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar: actual fill, target marker */}
              <div className="relative h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{
                    width: `${barActual}%`,
                    background: AREA_COLORS[area],
                    opacity: 0.7,
                  }}
                />
                {/* Target marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-gray-500 rounded-full"
                  style={{ left: `${barTarget}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {yearTotal === 0 && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500">
          No tasks scheduled for {year}
        </p>
      )}
    </div>
  );
}
