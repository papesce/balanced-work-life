"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Idea, LifeArea, Tag, getAreasForIdea } from "@/lib/types";
import { areaColors } from "@/styles/tokens";
import { AREA_LABELS, AREA_ORDER } from "@/lib/constants";
import { getToday } from "@/lib/dateUtils";

interface MiniBalanceBarProps {
  tasks: Idea[];
  getTagsForIdea?: (ideaId: string) => Tag[];
  date?: string;
}

export function MiniBalanceBar({ tasks, getTagsForIdea, date }: MiniBalanceBarProps) {
  const router = useRouter();
  const handleClick = () => {
    const d = date ?? getToday();
    router.push(`/balance?window=day&date=${d}`);
  };
  const segments = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.status !== "archived" && t.status !== "cancelled");
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
      const effectiveAreas = areas.length > 0 ? areas : (["life"] as LifeArea[]);
      const minutes = task.duration_minutes ?? 30;
      for (const area of effectiveAreas) counts[area] += minutes;
    }

    const total = AREA_ORDER.reduce((s, area) => s + counts[area], 0);
    if (total === 0) return [];

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
  }, [tasks, getTagsForIdea]);

  if (segments.length === 0) {
    return (
      <button
        onClick={handleClick}
        className="h-1.5 w-20 cursor-pointer rounded-full border border-dashed border-gray-300/30 bg-gray-200/50 transition-opacity hover:opacity-70 dark:border-gray-700/30 dark:bg-gray-800/50"
        title="No tasks planned — view balance"
        aria-label="View balance"
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      className="group relative flex cursor-pointer flex-col items-end gap-1"
      aria-label="View balance for this day"
    >
      {/* Segmented bar */}
      <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 transition-opacity hover:opacity-80 dark:bg-gray-800/40">
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
      <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="glass-card-strong flex min-w-[100px] flex-col gap-1 rounded-lg border border-black/5 px-2 py-1.5 text-[9px] font-semibold shadow-lg dark:border-white/5">
          {segments.map((seg) => (
            <div key={seg.area} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-gray-600 dark:text-gray-300">{AREA_LABELS[seg.area]}</span>
              </div>
              <span className="font-bold text-gray-400 dark:text-gray-500">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}
