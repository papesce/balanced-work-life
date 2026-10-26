"use client";

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { useQuickNoteData } from "@/contexts/QuickNoteContext";
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
 * Small launcher shown in the Daily Planner header when open notes have content.
 * Clicking opens the list when there is more than one note.
 */
export function QuickNoteChip() {
  const { note, totalUnreadCount, pendingNotesCount, openPanel } = useQuickNoteData();
  const age = useFormattedAge(note?.created_at ?? "", 60_000);

  if (!note || totalUnreadCount === 0) return null;

  const noteCount = pendingNotesCount;

  return (
    <button
      onClick={() => openPanel(noteCount > 1 ? "list" : undefined)}
      className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-violet-200/70 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/15"
      title={`Quick Notes (${totalUnreadCount} unresolved across ${noteCount} note${noteCount === 1 ? "" : "s"})`}
      aria-label={`Open quick notes: ${totalUnreadCount} unresolved tasks across ${noteCount} note${noteCount === 1 ? "" : "s"}, latest ${age}`}
    >
      <FileText size={12} />
      <span>Notes</span>
      <span>{totalUnreadCount}</span>
      <span className="font-medium text-violet-500/75 dark:text-violet-300/70">· {age}</span>
    </button>
  );
}
