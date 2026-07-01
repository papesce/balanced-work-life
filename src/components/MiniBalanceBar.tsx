"use client";

import { useMemo } from "react";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import { areaColors } from "@/styles/tokens";

interface MiniBalanceBarProps {
  tasks: Idea[];
  getTagsForIdea?: (ideaId: string) => Tag[];
}

const AREA_ORDER: LifeArea[] = ["work", "health", "relationships", "growth", "finances", "life"];

const AREA_LABELS: Record<LifeArea, string> = {
  work: "Work",
  health: "Health",
  relationships: "Relationships",
  growth: "Growth",
  finances: "Finances",
  life: "Life",
};

export function MiniBalanceBar({ tasks, getTagsForIdea }: MiniBalanceBarProps) {
  const segments = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.status !== "archived" && t.status !== "cancelled");
    const total = activeTasks.length;
    if (total === 0) return [];

    const counts: Record<LifeArea, number> = {
      work: 0,
      health: 0,
      relationships: 0,
      growth: 0,
      finances: 0,
      life: 0,
    };

    for (const task of activeTasks) {
      const tags = getTagsForIdea ? getTagsForIdea(task.id) : [];
      const areas = getAreasForIdea(tags);
      if (areas.length === 0) {
        counts["life"]++;
      } else {
        for (const area of areas) counts[area]++;
      }
    }

    return AREA_ORDER.map((area) => {
      const count = counts[area];
      const percentage = (count / total) * 100;
      return {
        area,
        count,
        percentage,
        color: areaColors[area]?.dot || "#cbd5e1",
      };
    }).filter((s) => s.count > 0);
  }, [tasks]);

  if (segments.length === 0) {
    return (
      <div 
        className="w-20 h-1.5 rounded-full bg-gray-200/50 dark:bg-gray-800/50 border border-dashed border-gray-300/30 dark:border-gray-700/30" 
        title="No tasks planned"
      />
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 group relative">
      {/* Segmented bar */}
      <div className="w-24 h-1.5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800/40">
        {segments.map((seg) => (
          <div
            key={seg.area}
            style={{
              width: `${seg.percentage}%`,
              backgroundColor: seg.color,
            }}
            className="h-full transition-all duration-300"
            title={`${AREA_LABELS[seg.area]}: ${seg.count} (${Math.round(seg.percentage)}%)`}
          />
        ))}
      </div>
      
      {/* Tooltip on hover */}
      <div className="absolute right-0 bottom-full mb-1.5 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50">
        <div className="glass-card-strong px-2 py-1.5 rounded-lg shadow-lg text-[9px] font-semibold flex flex-col gap-1 min-w-[100px] border border-black/5 dark:border-white/5">
          {segments.map((seg) => (
            <div key={seg.area} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-gray-600 dark:text-gray-300">{AREA_LABELS[seg.area]}</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 font-bold">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
