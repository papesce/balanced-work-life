"use client";

/* eslint react-hooks/refs: "off" -- memo calculations maintain deterministic row identity caches. */

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@powersync/react";
import type { QuickNote } from "@/lib/types";

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

/** Field-identical rows share one object so query re-emissions don't cascade. */
export function sameQuickNoteRow(a: QuickNote, b: QuickNote): boolean {
  return (
    a.id === b.id &&
    a.user_id === b.user_id &&
    a.text === b.text &&
    a.status === b.status &&
    a.created_at === b.created_at &&
    a.updated_at === b.updated_at &&
    a.archived_at === b.archived_at &&
    a.deleted_at === b.deleted_at
  );
}

/** Reuse the previous array when it holds the same objects in the same order. */
export function reuseIfIdentical(prev: QuickNote[], next: QuickNote[]): QuickNote[] {
  if (prev.length === next.length && next.every((r, i) => r === prev[i])) return prev;
  return next;
}

/**
 * Map fresh query rows onto stable identities: a field-identical row reuses
 * its cached object, a changed row mints a new one, and ids that left the
 * result set are pruned so the cache cannot grow without bound.
 */
export function stabilizeNoteRows(raw: QuickNote[], cache: Map<string, QuickNote>): QuickNote[] {
  const rows = raw.map((r) => {
    const prev = cache.get(r.id);
    if (prev && sameQuickNoteRow(prev, r)) return prev;
    const copy = { ...r };
    cache.set(r.id, copy);
    return copy;
  });
  if (cache.size > rows.length) {
    const ids = new Set(rows.map((r) => r.id));
    for (const key of cache.keys()) {
      if (!ids.has(key)) cache.delete(key);
    }
  }
  return rows;
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

  // Identity caches: keep referentially stable objects/arrays across query
  // re-emissions so downstream memos (and context values) only change when
  // the underlying data actually changed.
  const rowCacheRef = useRef(new Map<string, QuickNote>());
  const prevAllRef = useRef<QuickNote[]>([]);
  const prevOpenRef = useRef<QuickNote[]>([]);

  // Identity cache (deliberate render-phase ref use): the factory is
  // deterministic for a given rawRows — any field change mints a new object,
  // so updates are never swallowed; worst case is one extra render, never
  // stale UI.
  const allNotes: QuickNote[] = useMemo(
    () =>
      (() => {
        // PowerSync re-emits fresh row objects on every write, even when only
        // one row changed. Preserve identities so consumers only update when
        // their underlying row changes.
        const raw = (rawRows as unknown as QuickNote[]) ?? [];
        const rows = stabilizeNoteRows(raw, rowCacheRef.current);
        rows.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
            b.id.localeCompare(a.id),
        );
        prevAllRef.current = reuseIfIdentical(prevAllRef.current, rows);
        return prevAllRef.current;
      })(),
    [rawRows],
  );

  const openNotes = useMemo(
    () =>
      (() => {
        const filtered = sortByCreatedDesc(allNotes.filter((n) => n.status === "open"));
        prevOpenRef.current = reuseIfIdentical(prevOpenRef.current, filtered);
        return prevOpenRef.current;
      })(),
    [allNotes],
  );

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const latestOpenNote = useMemo(() => openNotes[0] ?? null, [openNotes]);

  const selectedNote = useMemo(() => {
    const id = selectedNoteId ?? latestOpenNote?.id;
    if (!id) return latestOpenNote;
    return allNotes.find((n) => n.id === id) ?? latestOpenNote;
  }, [selectedNoteId, allNotes, latestOpenNote]);

  const note = useMemo(
    () => (selectedNote?.status === "open" ? selectedNote : latestOpenNote),
    [selectedNote, latestOpenNote],
  );
  const isSelectedNoteLive = selectedNote?.status === "open";

  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  return useMemo(
    () => ({
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
    }),
    [
      allNotes,
      openNotes,
      isLoading,
      latestOpenNote,
      selectedNoteId,
      selectedNote,
      note,
      isSelectedNoteLive,
    ],
  );
}
