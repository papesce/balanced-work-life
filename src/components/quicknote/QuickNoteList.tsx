"use client";

import { useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { useQuickNoteData, type QuickNotePanelMode } from "@/contexts/QuickNoteContext";
import { parseNoteLines, unresolvedNonEmptyCount, formatAge } from "@/lib/quickNotes";
import { QuickNote } from "@/lib/types";
import type { QuickNoteOperationFailureReason } from "@/lib/quicknote/operations";

function getPreview(text: string): string {
  const lines = parseNoteLines(text);
  const first = lines.find((l) => l.text.trim() !== "");
  if (!first) return "Empty note";
  return first.text.length > 60 ? first.text.slice(0, 60) + "…" : first.text;
}

function NoteRow({
  note,
  isSelected,
  label,
  onSelect,
}: {
  note: QuickNote;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const preview = useMemo(() => getPreview(note.text), [note.text]);
  const age = useMemo(() => formatAge(note.created_at, "short"), [note.created_at]);
  // Actionable unresolved lines only — the same predicate the FAB badge
  // and chip counts use, so every quick-note number agrees.
  const unresolvedCount = useMemo(() => unresolvedNonEmptyCount(note.text), [note.text]);

  return (
    <button
      onClick={onSelect}
      title={new Date(note.created_at).toLocaleString()}
      aria-pressed={isSelected}
      className={`flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${
        isSelected
          ? "border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10"
          : "border-transparent hover:border-black/5 hover:bg-gray-50 dark:hover:border-white/5 dark:hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FileText size={14} className="shrink-0 text-violet-500" />
        <span className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
          {label}
        </span>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">{age}</span>
        {unresolvedCount > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            {unresolvedCount} {unresolvedCount === 1 ? "task" : "tasks"}
          </span>
        )}
      </div>
      <p className="truncate pl-[22px] text-xs text-gray-500 dark:text-gray-400">{preview}</p>
    </button>
  );
}

/**
 * List view: renders all open quick notes within the panel.
 * Each note is identified by its creation timestamp + first-line preview.
 * (Archiving was removed with batch process mode; pre-existing archived
 * notes stay in the DB and backups but are no longer listed.)
 */
export function QuickNoteList({
  onNavigate,
  onError,
}: {
  onNavigate?: (mode: QuickNotePanelMode, createdNoteId?: string) => void;
  onError?: (reason: QuickNoteOperationFailureReason) => void;
}) {
  const { openNotes, selectedNote, selectNote, createNote } = useQuickNoteData();
  const [creating, setCreating] = useState(false);

  const handleSelect = (id: string) => {
    void selectNote(id).then((result) => {
      if (result.ok) onNavigate?.("capture");
      else onError?.(result.reason);
    });
  };

  const handleNew = () => {
    if (creating) return;
    setCreating(true);
    void createNote()
      .then((result) => {
        if (result.ok) onNavigate?.("capture", result.id);
        else onError?.(result.reason);
      })
      .finally(() => setCreating(false));
  };

  if (openNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <FileText size={19} />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Nothing captured yet
        </p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          Start a quick note and come back to it whenever you need.
        </p>
        <button
          onClick={handleNew}
          disabled={creating}
          className="mt-4 flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          {creating ? "Creating…" : "New note"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4">
      {openNotes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Your notes{" "}
              <span className="font-normal text-gray-400 dark:text-gray-500">
                · {openNotes.length}
              </span>
            </p>
            <button
              onClick={handleNew}
              disabled={creating}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-300 dark:hover:bg-violet-500/10"
            >
              <Plus size={11} />
              {creating ? "Creating…" : "New note"}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {openNotes.map((n, i) => (
              <NoteRow
                key={n.id}
                note={n}
                isSelected={selectedNote?.id === n.id}
                label={`Note ${openNotes.length - i}`}
                onSelect={() => handleSelect(n.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
