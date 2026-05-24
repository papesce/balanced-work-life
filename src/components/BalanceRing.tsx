"use client";

interface BalanceRingProps {
  workCount: number;
  lifeCount: number;
  modeLabel: string;
  statLabel: string;
  statSub: string;
}

const CIRC = 2 * Math.PI * 60;
const WORK_COLOR = "#4F6BED";
const LIFE_COLOR = "#1D9E75";

export function BalanceRing({
  workCount,
  lifeCount,
  modeLabel,
  statLabel,
  statSub,
}: BalanceRingProps) {
  const total = workCount + lifeCount;
  const workPct = total ? Math.round((workCount / total) * 100) : 50;
  const lifePct = 100 - workPct;

  const gap = total > 0 ? 4 : 0;
  const workArc = total ? (workCount / total) * CIRC : CIRC / 2;
  const lifeArc = total ? (lifeCount / total) * CIRC : CIRC / 2;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
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
            stroke="#f3f4f6"
            strokeWidth="18"
          />
          {total > 0 && (
            <>
              <circle
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke={WORK_COLOR}
                strokeWidth="18"
                strokeDasharray={`${workArc - gap} ${CIRC - workArc + gap}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: "stroke-dasharray 0.4s, stroke-dashoffset 0.4s" }}
              />
              <circle
                cx="80"
                cy="80"
                r="60"
                fill="none"
                stroke={LIFE_COLOR}
                strokeWidth="18"
                strokeDasharray={`${lifeArc - gap} ${CIRC - lifeArc + gap}`}
                strokeDashoffset={`${-workArc}`}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
                style={{ transition: "stroke-dasharray 0.4s, stroke-dashoffset 0.4s" }}
              />
            </>
          )}
        </svg>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          {total === 0 ? (
            <>
              <div className="text-2xl font-medium text-gray-400">—</div>
              <div className="text-xs text-gray-400">no tasks</div>
            </>
          ) : workPct >= lifePct ? (
            <>
              <div className="text-2xl font-medium text-gray-900">{workPct}%</div>
              <div className="text-xs text-gray-500">work</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-medium text-gray-900">{lifePct}%</div>
              <div className="text-xs text-gray-500">life</div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-4 mb-5">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: WORK_COLOR }} />
          Work — {workCount}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: LIFE_COLOR }} />
          Life — {lifeCount}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <div className="text-xs text-gray-500">{statLabel}</div>
          <div className="text-lg font-medium text-gray-900">{total}</div>
          <div className="text-xs text-gray-400">{statSub}</div>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <div className="text-xs text-gray-500">Balance</div>
          <div className="text-lg font-medium text-gray-900">{workPct}% / {lifePct}%</div>
          <div className="text-xs text-gray-400">work / life</div>
        </div>
      </div>
    </div>
  );
}
