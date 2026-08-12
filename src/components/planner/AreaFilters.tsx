"use client";

import { areaColors } from "@/styles/tokens";
import { LifeArea } from "@/lib/types";
import { AREA_ORDER, AREA_LABELS, AREA_ICONS } from "@/lib/constants";

interface AreaFiltersProps {
  areaTaskCounts: Record<LifeArea, { pending: number; scheduled: number; done: number }>;
  selectedArea: LifeArea | null;
  onSelectArea: (area: LifeArea) => void;
  targets: Record<LifeArea, number>;
}

export function AreaFilters({
  areaTaskCounts,
  selectedArea,
  onSelectArea,
  targets,
}: AreaFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
          Life Area Filters
        </p>
        {selectedArea && (
          <button
            onClick={() => onSelectArea(selectedArea)}
            className="cursor-pointer text-[10px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {AREA_ORDER.map((area) => {
          const { pending, scheduled, done } = areaTaskCounts[area];
          const total = pending + scheduled + done;
          const Icon = AREA_ICONS[area];
          const isSelected = selectedArea === area;
          const color = areaColors[area]?.dot;
          const targetPct = targets[area] ?? 0;
          const totalAll = Object.values(areaTaskCounts).reduce(
            (sum, item) => sum + item.pending + item.scheduled + item.done,
            0,
          );
          const actualPct = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;

          return (
            <button
              key={area}
              onClick={() => onSelectArea(area)}
              className={`flex w-full cursor-pointer flex-col gap-1.5 rounded-2xl border p-3 text-left transition-all duration-200 ${
                isSelected
                  ? "scale-[1.01] border-violet-500/30 bg-white shadow-md dark:bg-white/[0.08]"
                  : "border-black/[0.03] bg-white/40 hover:border-black/5 hover:bg-white/70 dark:border-white/[0.02] dark:bg-white/[0.015] dark:hover:border-white/5 dark:hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: areaColors[area]?.bg }}
                >
                  <Icon size={12} style={{ color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs font-bold ${
                      isSelected
                        ? "text-gray-800 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {AREA_LABELS[area]}
                  </p>
                </div>
                <div className="text-[10px] font-bold text-gray-400 tabular-nums dark:text-gray-500">
                  {total > 0 ? `${total}m` : "0"}
                </div>
              </div>

              <div className="w-full space-y-1">
                <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500">
                  <span>Target: {targetPct}%</span>
                  {total > 0 && <span>Actual: {actualPct}%</span>}
                </div>
                <div className="flex h-1 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.04]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, actualPct)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
