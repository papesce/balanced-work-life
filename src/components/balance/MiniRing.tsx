"use client";

import { LifeArea } from "@/lib/types";

const AREA_COLORS: Record<LifeArea, string> = {
  work: "#4F6BED",
  health: "#EF4444",
  relationships: "#EC4899",
  growth: "#F59E0B",
  finances: "#10B981",
  life: "#8B5CF6",
};

interface MiniRingProps {
  counts: Record<LifeArea, number>;
  size?: number;
  strokeWidth?: number;
  showTotal?: boolean;
  dimmed?: boolean;
}

export function MiniRing({
  counts,
  size = 36,
  strokeWidth,
  showTotal = false,
  dimmed = false,
}: MiniRingProps) {
  const sw = strokeWidth ?? Math.max(3, size * 0.12);
  const cx = size / 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const gap = size < 50 ? 1 : 3;

  const areas = (Object.entries(counts) as [LifeArea, number][]).filter(([, c]) => c > 0);
  const total = areas.reduce((s, [, c]) => s + c, 0);

  const segments: { area: LifeArea; arc: number; offset: number }[] = [];
  let offset = 0;
  for (const [area, count] of areas) {
    const arc = (count / total) * circ;
    segments.push({ area, arc, offset });
    offset += arc;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ opacity: dimmed ? 0.25 : 1 }}
    >
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke="var(--ring-bg, #e5e7eb)"
        strokeWidth={sw}
      />
      {total > 0 &&
        segments.map(({ area, arc, offset: segOffset }) => (
          <circle
            key={area}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={AREA_COLORS[area]}
            strokeWidth={sw}
            strokeDasharray={`${Math.max(0, arc - gap)} ${circ - Math.max(0, arc - gap)}`}
            strokeDashoffset={`${-segOffset}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        ))}
      {showTotal && size >= 64 && (
        <text
          x={cx}
          y={cx}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.18}
          fill="currentColor"
          className="text-gray-700 dark:text-gray-200"
        >
          {total > 0 ? total : ""}
        </text>
      )}
    </svg>
  );
}
