"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@powersync/react";
import { QuickNote } from "@/lib/types";

export interface QuickNoteNotes {
  /** All notes (open + archived, excluding deleted), newest activity first. */
  allNotes: QuickNote[];
  /** Open notes, newest first. Derived — no second query. */
  openNotes: QuickNote[];
  loading: boolean;
  /** Latest open note (default selection + autosave target fallback). */
  latestOpenNote: QuickNote | null;
  /** Explicitly selected note id (null = follow latest). */
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string) => void;
  /** The note being viewed (may be open or archived). */
  selectedNote: QuickNote | null;
  /**
   * The note editing/processing operates on: the selected note when it is
   * open, else the latest open note. Null when there is nothing to edit.
   */
  note: QuickNote | null;
  /** Whether the viewed note is open (editable) as opposed to archived. */
  isSelectedNoteLive: boolean;
  /** Live ref of `note` for async callbacks (flush targets, discards). */
  noteRef: React.MutableRefObject<QuickNote | null>;
}

function sortByCreatedDesc(rows: QuickNote[]): QuickNote[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      b.id.localeCompare(a.id),
  );
}

/**
 * Single source for quick-note rows: ONE query (open + archived), with the
 * open list derived by filter. Previously two overlapping queries each
 * re-sorted client-side by different columns.
 */
export function useQuickNoteNotes(userId: string): QuickNoteNotes {
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM quick_notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC"
      : "SELECT * FROM quick_notes WHERE 0",
    userId ? [userId] : [],
  );

  const allNotes: QuickNote[] = useMemo(() => {
    const rows = ((rawRows as unknown as QuickNote[]) ?? []).map((r) => ({ ...r }));
    return rows.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        b.id.localeCompare(a.id),
    );
  }, [rawRows]);

  const openNotes = useMemo(
    () => sortByCreatedDesc(allNotes.filter((n) => n.status === "open")),
    [allNotes],
  );

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const latestOpenNote = openNotes[0] ?? null;

  const selectedNote = useMemo(() => {
    const id = selectedNoteId ?? latestOpenNote?.id;
    if (!id) return latestOpenNote;
    return allNotes.find((n) => n.id === id) ?? latestOpenNote;
  }, [selectedNoteId, allNotes, latestOpenNote]);

  const note = selectedNote?.status === "open" ? selectedNote : latestOpenNote;
  const isSelectedNoteLive = selectedNote?.status === "open";

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  return {
    allNotes,
    openNotes,
    loading: isLoading,
    latestOpenNote,
    selectedNoteId,
    setSelectedNoteId,
    selectedNote,
    note,
    isSelectedNoteLive,
    noteRef,
  };
}
