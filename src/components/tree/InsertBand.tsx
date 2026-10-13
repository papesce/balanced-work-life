"use client";

import { Plus } from "lucide-react";
import type { InsertZone } from "./useInsertBand";

interface InsertBandProps {
  label: string;
  depth: number;
  indentSize: number;
  insertBandLeadingOffset: number;
  insertZone: InsertZone;
  onInsert: (position: InsertZone) => void;
}

/**
 * Hover insertion band: dashed line + "+" = create, distinct from the solid
 * indigo lines used for drag-move. Depth-indented so the drawn slot matches
 * the created slot. Click target stays inside row bounds.
 */
export function InsertBand({
  label,
  depth,
  indentSize,
  insertBandLeadingOffset,
  insertZone,
  onInsert,
}: InsertBandProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onInsert(insertZone);
      }}
      aria-label={`Insert item ${insertZone === "top" ? "above" : "below"} ${label || "this item"}`}
      className="absolute right-0 z-10 flex cursor-pointer items-center px-0.5"
      style={{
        // This is absolutely positioned outside the row's normal-flow
        // content, so it needs its own depth offset to align with the
        // item being inserted.
        left: depth * indentSize + insertBandLeadingOffset,
        ...(insertZone === "top"
          ? { top: 0, height: `${100 / 3}%`, alignItems: "center" }
          : { bottom: 0, height: `${100 / 3}%`, alignItems: "center" }),
      }}
    >
      <span className="h-[2px] w-5 flex-shrink-0 rounded-full bg-indigo-400 dark:bg-indigo-500" />
      <span className="h-0 min-w-0 flex-1 border-t-2 border-dashed border-indigo-300 dark:border-indigo-500/60" />
      <Plus size={12} strokeWidth={2.5} className="flex-shrink-0 self-center text-indigo-400" />
    </button>
  );
}
