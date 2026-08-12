"use client";

import { LifeArea } from "@/lib/types";
import { AREA_LABELS } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";

interface BalanceRingProps {
  counts: Record<LifeArea, number>;
  modeLabel: string;
  statLabel: string;
  statSub: string;
}

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
      <p className="mb-4 min-h-[32px] text-center text-xs text-gray-500 dark:text-gray-400">
        {modeLabel}
      </p>

      <div className="relative mx-auto mb-5 h-40 w-40">
        <svg viewBox="0 0 160 160" className="h-full w-full">
          <circle cx="80" cy="80" r="60" fill="none" stroke="var(--ring-bg)" strokeWidth="18" />
          {total > 0 &&
            segments.map(({ area, arc, offset: segOffset }) => (
              <circle
                key={area}
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke={areaColors[area]?.dot}
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
              <div className="text-2xl font-medium text-gray-400 dark:text-gray-500">—</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">no tasks</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-medium text-gray-900 dark:text-gray-100">{total}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">minutes</div>
            </>
          )}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-3">
        {areas.map(([area, count]) => (
          <div
            key={area}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400"
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: areaColors[area]?.dot }}
            />
            {AREA_LABELS[area]} — {count}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
          <div className="text-xs text-gray-500 dark:text-gray-400">{statLabel}</div>
          <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{total}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{statSub}</div>
        </div>
        <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
          <div className="text-xs text-gray-500 dark:text-gray-400">Areas</div>
          <div className="text-lg font-medium text-gray-900 dark:text-gray-100">{areas.length}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">active</div>
        </div>
      </div>
    </div>
  );
}
