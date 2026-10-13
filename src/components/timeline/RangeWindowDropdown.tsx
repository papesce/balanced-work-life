"use client";

import { useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { FloatingPanel } from "@/components/shared/FloatingPanel";
import { TIMELINE_PRESETS, type TimelinePresetId } from "@/lib/timelinePresets";

export function RangeWindowDropdown({
  preset,
  counts,
  spans,
  open,
  onToggle,
  onClose,
  onSelect,
}: {
  preset: TimelinePresetId;
  counts: Record<string, string>;
  spans: Record<string, string>;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (id: TimelinePresetId) => void;
}) {
  const selected = TIMELINE_PRESETS.find((option) => option.id === preset) ?? TIMELINE_PRESETS[0];
  const [detailId, setDetailId] = useState<TimelinePresetId | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const detail = TIMELINE_PRESETS.find((option) => option.id === detailId);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 6, left: rect.left });
          onToggle();
        }}
        className={`toolbar-btn gap-1.5 px-2.5 ${open ? "toolbar-btn--accent" : "hover:text-gray-600 dark:hover:text-gray-300"}`}
      >
        <CalendarRange size={13} />
        <span>
          {selected.label}{" "}
          <span className="text-[10px] opacity-60">
            (−{selected.before} / +{selected.after})
          </span>
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && menuPos && (
        <FloatingPanel
          anchor={menuPos}
          onClose={onClose}
          className="glass-card-strong min-w-[250px] rounded-xl border border-black/5 p-1.5 shadow-xl dark:border-white/5"
        >
          {TIMELINE_PRESETS.map((r, index) => (
            <div key={r.id}>
              {(index === 0 || r.group !== TIMELINE_PRESETS[index - 1].group) && (
                <div className="px-2.5 pt-2 pb-1 text-[9px] font-bold tracking-[0.14em] text-gray-400 uppercase dark:text-gray-500">
                  {r.group} window
                </div>
              )}
              <button
                onClick={() => onSelect(r.id)}
                onMouseEnter={() => setDetailId(r.id as TimelinePresetId)}
                onFocus={() => setDetailId(r.id as TimelinePresetId)}
                className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${
                  r.id === preset
                    ? "bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400"
                    : "text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span>
                  <span className="font-bold">{r.label}</span>
                  <span className="mt-0.5 block text-[10px] font-normal text-gray-400">
                    {r.description}
                  </span>
                </span>
                {r.id === preset && <span className="mt-0.5 text-violet-500">✓</span>}
              </button>
            </div>
          ))}
          {detail && (
            <div className="mt-1 border-t border-black/5 px-2.5 pt-2 pb-1 text-[10px] text-gray-500 dark:border-white/5 dark:text-gray-400">
              <div className="font-semibold text-gray-600 dark:text-gray-300">
                {detail.label} · {spans[detail.id]}
              </div>
              <div className="mt-0.5">{counts[detail.id] ?? "0 before · 0 after"}</div>
            </div>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
