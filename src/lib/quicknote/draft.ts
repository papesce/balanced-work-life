"use client";

import { useState, useRef, useCallback } from "react";
import { qnLogInput } from "./log";

export interface QuickNoteDraftApi {
  /** Current draft text (React state, for rendering). */
  draft: string;
  /** Synchronous draft value — the ONLY source flushes may read. */
  draftRef: React.MutableRefObject<string>;
  dirtyRef: React.MutableRefObject<boolean>;
  writingRef: React.MutableRefObject<boolean>;
  lastWrittenRef: React.MutableRefObject<string | null>;
  /** Which note id the draft belongs to (provenance for write targeting). */
  draftNoteIdRef: React.MutableRefObject<string | null>;
  /** Text at the last save/load/switch — dirty is truthful against this. */
  baseTextRef: React.MutableRefObject<string>;
  explicitEditRef: React.MutableRefObject<boolean>;
  /** Single writer: keeps state and ref in sync (no split-brain). */
  setDraft: (text: string) => void;
  /** Load a note's text from DB (select / switch / initial). Clears dirty. */
  load: (noteId: string | null, text: string) => void;
  /** Record a user edit; returns whether it differs from base (isDirty). */
  edit: (caller: string, text: string) => boolean;
  /** Record a successful persist of `text`. */
  markSaved: (text: string) => void;
  /** Set which note the draft belongs to (pending-mint, rehome). */
  setNoteId: (noteId: string | null) => void;
  /** Set the dirty flag directly (flush outcomes). */
  setDirty: (dirty: boolean) => void;
  /** Mark a write as in flight (stale-query guard). */
  beginWrite: (text: string) => void;
  /** Clear the in-flight write marker (landed). */
  clearWriting: () => void;
  /** Clear write tracking (note switch / discard). */
  clearWriteState: () => void;
  /** Detach from the current note, keeping draft text (post-discard). */
  detach: () => void;
  /** Clear everything (discard / fresh state). */
  reset: () => void;
}

/**
 * Owns the quick-note draft state machine. All transitions go through this
 * hook so the invariants hold by construction:
 * - state and ref are never out of sync (single `setDraft` writer),
 * - `dirty` is truthful against `base` (typing back to saved text clears it),
 * - provenance (`draftNoteId`, `base`, `explicitEdit`) is updated atomically
 *   with every load/edit/save — no call site can forget one piece.
 */
export function useQuickNoteDraft(): QuickNoteDraftApi {
  const [draft, setDraftState] = useState("");
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const writingRef = useRef(false);
  const lastWrittenRef = useRef<string | null>(null);
  const draftNoteIdRef = useRef<string | null>(null);
  const baseTextRef = useRef("");
  const explicitEditRef = useRef(false);

  const setDraft = useCallback((text: string) => {
    draftRef.current = text;
    setDraftState(text);
  }, []);

  const load = useCallback(
    (noteId: string | null, text: string) => {
      setDraft(text);
      draftNoteIdRef.current = noteId;
      baseTextRef.current = text;
      explicitEditRef.current = false;
      dirtyRef.current = false;
    },
    [setDraft],
  );

  const edit = useCallback(
    (caller: string, text: string) => {
      qnLogInput(caller, draftRef.current, text);
      setDraft(text);
      explicitEditRef.current = true;
      const isDirty = text !== baseTextRef.current;
      dirtyRef.current = isDirty;
      return isDirty;
    },
    [setDraft],
  );

  const markSaved = useCallback((text: string) => {
    baseTextRef.current = text;
    explicitEditRef.current = false;
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const setNoteId = useCallback((noteId: string | null) => {
    draftNoteIdRef.current = noteId;
  }, []);

  const beginWrite = useCallback((text: string) => {
    writingRef.current = true;
    lastWrittenRef.current = text;
  }, []);

  const clearWriting = useCallback(() => {
    writingRef.current = false;
  }, []);

  const clearWriteState = useCallback(() => {
    writingRef.current = false;
    lastWrittenRef.current = null;
  }, []);

  const detach = useCallback(() => {
    dirtyRef.current = false;
    writingRef.current = false;
    lastWrittenRef.current = null;
    draftNoteIdRef.current = null;
    baseTextRef.current = "";
    explicitEditRef.current = false;
  }, []);

  const reset = useCallback(() => {
    dirtyRef.current = false;
    writingRef.current = false;
    lastWrittenRef.current = null;
    draftNoteIdRef.current = null;
    baseTextRef.current = "";
    explicitEditRef.current = false;
    setDraft("");
  }, [setDraft]);

  return {
    draft,
    draftRef,
    dirtyRef,
    writingRef,
    lastWrittenRef,
    draftNoteIdRef,
    baseTextRef,
    explicitEditRef,
    setDraft,
    load,
    edit,
    markSaved,
    setDirty,
    setNoteId,
    beginWrite,
    clearWriting,
    clearWriteState,
    detach,
    reset,
  };
}
