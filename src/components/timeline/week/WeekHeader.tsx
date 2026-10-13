"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEK_CARD_PREVIEWS, type WeekCardPreview } from "@/components/timeline/WeekStripView";
import { addDays, getToday } from "@/lib/dateUtils";

export function WeekHeader({
  anchor,
  weekLabel,
  containsToday,
  weekTotals,
  cardPreview,
  onAnchorChange,
  onCardPreviewChange,
}: {
  anchor: string;
  weekLabel: string;
  containsToday: boolean;
  weekTotals: { total: number; done: number };
  cardPreview: WeekCardPreview;
  onAnchorChange: (date: string) => void;
  onCardPreviewChange: (preview: WeekCardPreview) => void;
}) {
  return (
    <div className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-[20px] px-4 py-2.5">
      <button
        onClick={() => onAnchorChange(addDays(anchor, -7))}
        aria-label="Previous week"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <button
          onClick={() => onAnchorChange(getToday())}
          title="Jump to this week"
          className="text-sm font-bold text-gray-900 hover:text-violet-600 dark:text-gray-100 dark:hover:text-violet-400"
        >
          {weekLabel}
        </button>
        {containsToday && (
          <span className="rounded-full bg-emerald-100/80 px-1.5 py-px text-[9px] font-bold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            This week
          </span>
        )}
        {weekTotals.total > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 tabular-nums dark:text-gray-500">
            {weekTotals.done}/{weekTotals.total} done
          </span>
        )}
        <span
          className="flex items-center gap-0.5 rounded-lg border border-black/5 bg-white/70 p-0.5 dark:border-white/5 dark:bg-gray-900/60"
          role="group"
          aria-label="Day card preview"
        >
          {WEEK_CARD_PREVIEWS.map((p) => (
            <button
              key={p.id}
              onClick={() => onCardPreviewChange(p.id)}
              aria-pressed={cardPreview === p.id}
              title={`Show ${p.label.toLowerCase()} on each day card`}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
                cardPreview === p.id
                  ? "bg-white font-bold text-violet-600 shadow-sm dark:bg-gray-800 dark:text-violet-400"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <button
        onClick={() => onAnchorChange(addDays(anchor, 7))}
        aria-label="Next week"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
