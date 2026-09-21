"use client";

import { useMemo } from "react";
import { FileText, Archive } from "lucide-react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { parseNoteLines } from "@/lib/quickNotes";
import { QuickNote } from "@/lib/types";

function formatAge(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function getPreview(text: string): string {
  const lines = parseNoteLines(text);
  const first = lines.find((l) => l.text.trim() !== "");
  if (!first) return "Empty note";
  return first.text.length > 60 ? first.text.slice(0, 60) + "…" : first.text;
}

function NoteRow({
  note,
  isSelected,
  isLive,
  onSelect,
}: {
  note: QuickNote;
  isSelected: boolean;
  isLive: boolean;
  onSelect: () => void;
}) {
  const preview = useMemo(() => getPreview(note.text), [note.text]);
  const age = useMemo(() => formatAge(note.created_at), [note.created_at]);
  const unresolvedCount = useMemo(
    () => parseNoteLines(note.text).filter((l) => !l.resolved && l.text.trim() !== "").length,
    [note.text],
  );

  return (
    <button
      onClick={onSelect}
      className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "bg-violet-50 dark:bg-violet-950/20"
          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-2">
        {isLive ? (
          <FileText size={12} className="shrink-0 text-violet-500" />
        ) : (
          <Archive size={12} className="shrink-0 text-gray-400 dark:text-gray-500" />
        )}
        <span className="flex-1 truncate text-xs font-medium text-gray-700 dark:text-gray-300">
          {isLive ? "Current note" : age + " ago"}
        </span>
        {unresolvedCount > 0 && (
          <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            {unresolvedCount}
          </span>
        )}
        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{age}</span>
      </div>
      <p className="truncate pl-5 text-[11px] text-gray-400 dark:text-gray-500">{preview}</p>
    </button>
  );
}

/**
 * List view: renders all quick notes grouped by status within the panel.
 */
export function QuickNoteList() {
  const { allNotes, selectedNote, selectNote, note } = useQuickNoteContext();

  const openNotes = useMemo(() => allNotes.filter((n) => n.status === "open"), [allNotes]);
  const archivedNotes = useMemo(() => allNotes.filter((n) => n.status === "archived"), [allNotes]);

  if (allNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText size={24} className="mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet</p>
        <p className="mt-1 text-xs text-gray-300 dark:text-gray-600">
          Start typing to create your first quick note
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {openNotes.length > 0 && (
        <div>
          <p className="mb-1 px-3 pt-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Open
          </p>
          {openNotes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              isSelected={selectedNote?.id === n.id}
              isLive={n.id === note?.id}
              onSelect={() => {
                selectNote(n.id);
              }}
            />
          ))}
        </div>
      )}

      {archivedNotes.length > 0 && (
        <div>
          <p className="mb-1 px-3 pt-3 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Archived
          </p>
          {archivedNotes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              isSelected={selectedNote?.id === n.id}
              isLive={n.id === note?.id}
              onSelect={() => {
                selectNote(n.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
