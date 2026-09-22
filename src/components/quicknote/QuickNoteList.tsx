"use client";

import { useMemo, useState } from "react";
import { FileText, Archive, Plus } from "lucide-react";
import { useQuickNoteContext, type QuickNotePanelMode } from "@/contexts/QuickNoteContext";
import { parseNoteLines, formatAge } from "@/lib/quickNotes";
import { QuickNote } from "@/lib/types";

function getPreview(text: string): string {
  const lines = parseNoteLines(text);
  const first = lines.find((l) => l.text.trim() !== "");
  if (!first) return "Empty note";
  return first.text.length > 60 ? first.text.slice(0, 60) + "…" : first.text;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function NoteRow({
  note,
  isSelected,
  isLive,
  label,
  onSelect,
}: {
  note: QuickNote;
  isSelected: boolean;
  isLive: boolean;
  label: string;
  onSelect: () => void;
}) {
  const preview = useMemo(() => getPreview(note.text), [note.text]);
  const age = useMemo(() => formatAge(note.created_at, "short"), [note.created_at]);
  const timestamp = useMemo(() => formatTimestamp(note.created_at), [note.created_at]);
  const unresolvedCount = useMemo(
    () => parseNoteLines(note.text).filter((l) => !l.resolved && l.text.trim() !== "").length,
    [note.text],
  );

  return (
    <button
      onClick={onSelect}
      title={new Date(note.created_at).toLocaleString()}
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
          {label} · {timestamp}
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
 * Each note is identified by its creation timestamp + first-line preview.
 */
export function QuickNoteList({ onNavigate }: { onNavigate?: (mode: QuickNotePanelMode) => void }) {
  const { allNotes, openNotes, selectedNote, selectNote, createNote, note } = useQuickNoteContext();
  const [creating, setCreating] = useState(false);

  const archivedNotes = useMemo(() => allNotes.filter((n) => n.status === "archived"), [allNotes]);

  const handleSelect = (id: string) => {
    void selectNote(id).then(() => onNavigate?.("capture"));
  };

  const handleNew = () => {
    if (creating) return;
    setCreating(true);
    void createNote()
      .then(() => onNavigate?.("capture"))
      .finally(() => setCreating(false));
  };

  if (allNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText size={24} className="mb-2 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No notes yet</p>
        <button
          onClick={handleNew}
          disabled={creating}
          className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-950/20 dark:text-violet-400"
        >
          <Plus size={13} />
          {creating ? "Creating…" : "New note"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {openNotes.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between px-3 pt-1">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
              Open · {openNotes.length}
            </p>
            <button
              onClick={handleNew}
              disabled={creating}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-400 dark:hover:bg-violet-950/20"
            >
              <Plus size={11} />
              {creating ? "Creating…" : "New note"}
            </button>
          </div>
          {openNotes.map((n, i) => (
            <NoteRow
              key={n.id}
              note={n}
              isSelected={selectedNote?.id === n.id}
              isLive={n.id === note?.id}
              label={`Note ${openNotes.length - i}`}
              onSelect={() => handleSelect(n.id)}
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
              label="Archived"
              onSelect={() => handleSelect(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
