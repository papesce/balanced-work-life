"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText } from "lucide-react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";

function useNow(intervalMs: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function formatAge(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Small chip shown in the Daily Planner header when an open note has content.
 * Shows unresolved line count and age. Clicking opens the panel.
 */
export function QuickNoteChip() {
  const { note, unreadCount, openPanel } = useQuickNoteContext();
  const tick = useNow(60_000);

  const age = useMemo(
    () => (note ? formatAge(note.created_at) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note?.id, note?.created_at, tick],
  );

  if (!note || unreadCount === 0) return null;

  return (
    <button
      onClick={openPanel}
      className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-600 transition-colors hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
      title={`Quick Note (${unreadCount} unresolved)`}
    >
      <FileText size={12} />
      <span>{unreadCount}</span>
      <span className="font-medium text-violet-400/70 dark:text-violet-500/50">· {age}</span>
    </button>
  );
}
