"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { formatAge } from "@/lib/quickNotes";

function useFormattedAge(isoTimestamp: string, intervalMs: number): string {
  const [age, setAge] = useState(() => formatAge(isoTimestamp));
  useEffect(() => {
    const id = setInterval(() => setAge(formatAge(isoTimestamp)), intervalMs);
    return () => clearInterval(id);
  }, [isoTimestamp, intervalMs]);
  return age;
}

/**
 * Small chip shown in the Daily Planner header when an open note has content.
 * Shows unresolved line count and age. Clicking opens the panel.
 */
export function QuickNoteChip() {
  const { note, unreadCount, openPanel } = useQuickNoteContext();
  const age = useFormattedAge(note?.created_at ?? "", 60_000);

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
