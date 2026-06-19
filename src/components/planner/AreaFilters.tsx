"use client";

import { areaColors } from "@/styles/tokens";
import { LifeArea } from "@/lib/types";
import { AREA_ORDER, AREA_LABELS, AREA_ICONS } from "./constants";

interface AreaFiltersProps {
  areaTaskCounts: Record<LifeArea, { pending: number; done: number }>;
  selectedArea: LifeArea | null;
  onSelectArea: (area: LifeArea) => void;
  targets: Record<LifeArea, number>;
}

export function AreaFilters({ areaTaskCounts, selectedArea, onSelectArea, targets }: AreaFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Life Area Filters
        </p>
        {selectedArea && (
          <button
            onClick={() => onSelectArea(selectedArea)}
            className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {AREA_ORDER.map((area) => {
          const { pending, done } = areaTaskCounts[area];
          const Icon = AREA_ICONS[area];
          const isSelected = selectedArea === area;
          const color = areaColors[area]?.dot;
          const targetPct = targets[area] ?? 0;
          const totalPending = Object.values(areaTaskCounts).reduce((sum, item) => sum + item.pending, 0);
          const actualPct = totalPending > 0 ? Math.round((pending / totalPending) * 100) : 0;

          return (
            <button
              key={area}
              onClick={() => onSelectArea(area)}
              className={`w-full flex flex-col gap-1.5 p-3 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-white dark:bg-white/[0.08] border-violet-500/30 shadow-md scale-[1.01]"
                  : "bg-white/40 dark:bg-white/[0.015] border-black/[0.03] dark:border-white/[0.02] hover:bg-white/70 dark:hover:bg-white/[0.04] hover:border-black/5 dark:hover:border-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-5.5 h-5.5 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: areaColors[area]?.bg }}
                >
                  <Icon size={12} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${
                    isSelected ? "text-gray-800 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {AREA_LABELS[area]}
                  </p>
                </div>
                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                  {pending > 0 ? `${pending} pending` : done > 0 ? "✓ done" : "0"}
                </div>
              </div>

              <div className="w-full space-y-1">
                <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500">
                  <span>Target: {targetPct}%</span>
                  {pending > 0 && <span>Actual: {actualPct}%</span>}
                </div>
                <div className="w-full h-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-full overflow-hidden flex">
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
