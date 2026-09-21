"use client";

import { useMemo } from "react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { parseNoteLines } from "@/lib/quickNotes";
import { QuickNoteLineRow } from "./QuickNoteLineRow";

/**
 * Process mode: renders one row per non-blank, unresolved line.
 * Resolved lines are shown dimmed at the bottom.
 * When viewing an archived note, lines are displayed read-only.
 */
export function QuickNoteProcess() {
  const { draft, isSelectedNoteLive } = useQuickNoteContext();
  const readonly = !isSelectedNoteLive;

  const lines = useMemo(() => parseNoteLines(draft), [draft]);
  const unresolved = lines.filter((l) => !l.resolved);
  const resolved = lines.filter((l) => l.resolved);

  return (
    <div className="flex flex-col gap-1 p-4">
      {readonly && (
        <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
          Read-only
        </p>
      )}

      {unresolved.length === 0 && resolved.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No lines to process.
        </p>
      )}

      {unresolved.map((line) =>
        readonly ? (
          <div
            key={line.index}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300"
          >
            <span className="text-gray-300 dark:text-gray-600">○</span>
            <span className="truncate">{line.text}</span>
          </div>
        ) : (
          <QuickNoteLineRow key={line.index} line={line} />
        ),
      )}

      {resolved.length > 0 && (
        <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/5">
          <p className="mb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Resolved
          </p>
          {resolved.map((line) => (
            <div
              key={line.index}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-gray-400 line-through dark:text-gray-500"
            >
              <span className="text-green-500">✓</span>
              <span className="truncate">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
