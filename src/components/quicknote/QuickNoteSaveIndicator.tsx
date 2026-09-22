"use client";

import { useQuickNoteContext } from "@/contexts/QuickNoteContext";

function formatSavedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Small autosave feedback indicator ("Saving…", "Unsaved changes", "Saved 14:32").
 * Rendered in the capture footer and the panel header.
 */
export function QuickNoteSaveIndicator({ compact = false }: { compact?: boolean }) {
  const { saveStatus, lastSavedAt, note } = useQuickNoteContext();

  // Before any edit this session, fall back to the persisted updated_at.
  const fallbackAt = !lastSavedAt ? note?.updated_at : undefined;
  const effectiveSavedAt = lastSavedAt ?? fallbackAt ?? null;
  if (saveStatus === "idle" && !effectiveSavedAt) return null;

  let dotClass = "bg-gray-300 dark:bg-gray-600";
  let textClass = "text-gray-400 dark:text-gray-500";
  let label = "";

  if (saveStatus === "editing") {
    dotClass = "bg-amber-400";
    textClass = "text-amber-600 dark:text-amber-400";
    label = "Unsaved changes";
  } else if (saveStatus === "saving") {
    dotClass = "animate-pulse bg-violet-500";
    textClass = "text-violet-500 dark:text-violet-400";
    label = "Saving…";
  } else if (saveStatus === "error") {
    dotClass = "bg-red-500";
    textClass = "text-red-600 dark:text-red-400";
    label = "Save failed — will retry";
  } else if (saveStatus === "saved" || saveStatus === "idle") {
    dotClass = "bg-emerald-500";
    const time = effectiveSavedAt ? formatSavedTime(effectiveSavedAt) : "";
    label = time ? `Saved ${time}` : "Saved";
  }

  return (
    <span
      aria-live="polite"
      title={effectiveSavedAt ? `Last saved ${new Date(effectiveSavedAt).toLocaleString()}` : label}
      className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${textClass} ${compact ? "" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}
