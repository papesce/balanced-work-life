"use client";

import { useEffect, useRef, useState } from "react";
import { useClassifications } from "@/hooks/useClassifications";

/** Classification value for the `priority` scheme, or null when unranked. */
export type PriorityValue = "high" | "medium" | "low" | null;

const OPTIONS: { value: Exclude<PriorityValue, null>; short: string; label: string }[] = [
  { value: "high", short: "H", label: "High" },
  { value: "medium", short: "M", label: "Medium" },
  { value: "low", short: "L", label: "Low" },
];

const CHIP_STYLES: Record<Exclude<PriorityValue, null>, string> = {
  high: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
  medium:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  low: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
};

interface PriorityChipProps {
  value: PriorityValue;
  onSelect: (value: Exclude<PriorityValue, null> | null) => void;
  size?: "xs" | "sm";
}

export function PriorityChip({ value, onSelect, size = "xs" }: PriorityChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = OPTIONS.find((o) => o.value === value);
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";

  return (
    <span
      ref={ref}
      className="relative inline-flex flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        title={active ? `Priority: ${active.label}` : "Set priority"}
        aria-label={active ? `Priority: ${active.label}` : "Set priority"}
        className={`rounded-full border px-1.5 py-0 font-semibold whitespace-nowrap transition hover:opacity-80 ${textSize} ${
          active
            ? CHIP_STYLES[active.value]
            : "border-dashed border-black/15 text-gray-300 hover:text-gray-500 dark:border-white/15 dark:text-gray-600 dark:hover:text-gray-400"
        }`}
      >
        {active ? active.short : "–"}
      </button>
      {open && (
        <span className="glass-card-strong absolute top-full left-0 z-50 mt-1 min-w-[120px] rounded-xl py-1 shadow-lg">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
            >
              <span
                className={`rounded-full border px-1.5 py-0 text-[10px] font-semibold ${CHIP_STYLES[o.value]}`}
              >
                {o.short}
              </span>
              {o.label}
              {value === o.value && <span className="ml-auto text-[9px] opacity-50">✓</span>}
            </button>
          ))}
          {value !== null && (
            <button
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-gray-400 hover:bg-black/[0.03] dark:text-gray-500 dark:hover:bg-white/[0.04]"
            >
              Clear
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/** Sort rank for priority values: high first, unranked last. */
export function priorityRank(value: PriorityValue): number {
  switch (value) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

/**
 * Self-sufficient chip bound to the `priority` classification scheme.
 * Reads/writes via useClassifications directly (no undo) — for rows where
 * threading page-level setters is impractical (planner, timeline).
 * Prefer the pure PriorityChip with injected value/onSelect where undo matters.
 */
export function PriorityChipField({ ideaId, size }: { ideaId: string; size?: "xs" | "sm" }) {
  const { getOptionForIdea, setClassification } = useClassifications();
  const value = (getOptionForIdea(ideaId, "priority")?.value ?? null) as PriorityValue;
  return (
    <PriorityChip
      value={value}
      onSelect={(v) => void setClassification(ideaId, "priority", v)}
      size={size}
    />
  );
}
