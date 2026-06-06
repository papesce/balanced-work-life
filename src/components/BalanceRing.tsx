"use client";

import { LifeArea } from "@/lib/types";

interface BalanceRingProps {
  counts: Record<LifeArea, number>;
  modeLabel: string;
  statLabel: string;
  statSub: string;
}

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

const CIRC = 2 * Math.PI * 60;
const GAP = 4;

export function BalanceRing({ counts, modeLabel, statLabel, statSub }: BalanceRingProps) {
  const areas = Object.entries(counts).filter(([, count]) => count > 0) as [LifeArea, number][];
  const total = areas.reduce((sum, [, count]) => sum + count, 0);

  const segments: { area: LifeArea; arc: number; offset: number }[] = [];
  let offset = 0;
  for (const [area, count] of areas) {
    const arc = (count / total) * CIRC;
    segments.push({ area, arc, offset });
    offset += arc;
  }

  return (
    <div className="glass-card rounded-[20px] p-5">
      <p className="text-xs text-gray-500 text-center mb-4 min-h-[32px]">
        {modeLabel}
      </p>

      <div className="relative w-40 h-40 mx-auto mb-5">
        <svg viewBox="0 0 160 160" className="w-full h-full">
          <circle
            cx="80"
            cy="80"
            r="60"
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="18"
          />
          {total > 0 && segments.map(({ area, arc, offset: segOffset }) => (
            <circle
              key={area}
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke={AREA_COLORS[area]}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, arc - GAP)} ${CIRC - Math.max(0, arc - GAP)}`}
              strokeDashoffset={`${-segOffset}`}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-dasharray 0.4s, stroke-dashoffset 0.4s" }}
            />
          ))}
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          {total === 0 ? (
            <>
              <div className="text-2xl font-medium text-gray-400">—</div>
              <div className="text-xs text-gray-400">no items</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-medium text-gray-900">{total}</div>
              <div className="text-xs text-gray-500">items</div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-5">
        {areas.map(([area, count]) => (
          <div key={area} className="flex items-center gap-1.5 text-sm text-gray-600">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: AREA_COLORS[area] }} />
            {AREA_LABELS[area]} — {count}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-black/[0.03] rounded-xl px-3 py-2.5">
          <div className="text-xs text-gray-500">{statLabel}</div>
          <div className="text-lg font-medium text-gray-900">{total}</div>
          <div className="text-xs text-gray-400">{statSub}</div>
        </div>
        <div className="bg-black/[0.03] rounded-xl px-3 py-2.5">
          <div className="text-xs text-gray-500">Areas</div>
          <div className="text-lg font-medium text-gray-900">{areas.length}</div>
          <div className="text-xs text-gray-400">active</div>
        </div>
      </div>
    </div>
  );
}
