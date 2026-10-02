"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import type { QuickNote } from "@/lib/types";
import type { QuickNoteSaveStatus } from "./types";
import type { QuickNoteDraftApi } from "./draft";

export interface QuickNotePersistence {
  saveStatus: QuickNoteSaveStatus;
  lastSavedAt: string | null;
  hasUnsaved: boolean;
  pendingNoteIdRef: React.MutableRefObject<string | null>;
  pendingInsertedRef: React.MutableRefObject<boolean>;
  /** THE single write path: every flush funnels through here. */
  persistDraft: (text: string) => Promise<boolean>;
  flushAutosave: () => Promise<void>;
  scheduleAutosave: () => void;
  cancelAutosave: () => void;
  resetPending: () => void;
  markSaving: () => void;
  markIdle: (savedAt: string | null) => void;
  markError: () => void;
  updateText: (text: string) => void;
}

interface PersistenceDeps {
  db: AbstractPowerSyncDatabase;
  userId: string;
  draft: QuickNoteDraftApi;
  /** Live ref of the ACTIVE note (may differ from the viewed note). */
  activeNoteRef: React.MutableRefObject<QuickNote | null>;
}

/**
 * Owns everything about getting draft text into the local DB: lazy pending
 * ids, the debounced timer, all flush origins, save status, and the two edit
 * entry points. There is exactly ONE write implementation (`persistDraft`) —
 * previously the same flush existed in three variants that diverged.
 */
export function useQuickNotePersistence({
  db,
  userId,
  draft,
  activeNoteRef,
}: PersistenceDeps): QuickNotePersistence {
  const [saveStatus, setSaveStatus] = useState<QuickNoteSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNoteIdRef = useRef<string | null>(null);
  const pendingInsertedRef = useRef(false);

  // Bind the draft's stable callbacks/refs once. The `draft` object identity
  // changes on every keystroke (it carries the text), so depending on it
  // wholesale would rebuild every write path per character.
  const {
    draftRef,
    dirtyRef,
    baseTextRef,
    draftNoteIdRef,
    explicitEditRef,
    edit: editDraft,
    setNoteId: setDraftNoteId,
    setDirty: setDraftDirty,
    beginWrite: beginDraftWrite,
    markSaved: markDraftSaved,
  } = draft;

  const cancelAutosave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }, []);

  const resetPending = useCallback(() => {
    pendingNoteIdRef.current = null;
    pendingInsertedRef.current = false;
  }, []);

  const markSaving = useCallback(() => setSaveStatus("saving"), []);
  const markIdle = useCallback((savedAt: string | null) => {
    setLastSavedAt(savedAt);
    setSaveStatus("idle");
  }, []);
  const markError = useCallback(() => setSaveStatus("error"), []);

  const persistDraft = useCallback(
    async (text: string): Promise<boolean> => {
      const existingNote = activeNoteRef.current;
      const pendingId = pendingNoteIdRef.current;
      const now = new Date().toISOString();
      try {
        // Resolve the write target from draft provenance, NOT from whatever
        // note happens to be active: the draft may belong to a different
        // (e.g. archived, browsed) note, and flushing it into the active row
        // would be a cross-note overwrite.
        const draftNoteId = draftNoteIdRef.current;
        let target: { kind: "existing" | "pending"; id: string } | null = null;
        if (draftNoteId && existingNote && draftNoteId === existingNote.id) {
          target = { kind: "existing", id: existingNote.id };
        } else if (draftNoteId && pendingId && draftNoteId === pendingId) {
          target = { kind: "pending", id: pendingId };
        } else if (!draftNoteId && existingNote) {
          target = { kind: "existing", id: existingNote.id };
        } else if (!draftNoteId && pendingId && userId) {
          target = { kind: "pending", id: pendingId };
        }
        if (!target) {
          if (text.trim().length > 0 && userId) {
            // No target yet (e.g. note was discarded mid-typing): mint an id
            // now rather than dropping the text.
            const id = uuidv4();
            pendingNoteIdRef.current = id;
            setDraftNoteId(id);
            beginDraftWrite(text);
            const params = [id, userId, text, "open", now, now];
            await db.execute(
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            pendingInsertedRef.current = true;
            markDraftSaved(text);
          } else if (draftNoteId) {
            // Draft belongs to a note that is neither active nor pending.
            // Refuse rather than writing one note's text into another's row.
            return false;
          } else {
            return true;
          }
          setLastSavedAt(now);
          setSaveStatus("saved");
          return true;
        }

        if (target.kind === "existing") {
          // Empty-overwrite guard: never blank a non-empty row unless the
          // user explicitly edited the text to empty after the base was set.
          if (text.length === 0 && !explicitEditRef.current) {
            const rows = await db.getAll<{ text: string }>(
              "SELECT text FROM quick_notes WHERE id = ?",
              [target.id],
            );
            const dbText = rows[0]?.text ?? "";
            if (dbText.length > 0) {
              setDraftDirty(false);
              return true;
            }
          }
          beginDraftWrite(text);
          const params = [text, now, target.id];
          await db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
        } else {
          const targetPendingId = target.id;
          if (pendingInsertedRef.current) {
            beginDraftWrite(text);
            const params = [text, now, targetPendingId];
            await db.execute(
              "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
              params,
            );
          } else {
            beginDraftWrite(text);
            const params = [targetPendingId, userId, text, "open", now, now];
            await db.execute(
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            pendingInsertedRef.current = true;
          }
        }
        markDraftSaved(text);
        setLastSavedAt(now);
        setSaveStatus("saved");
        return true;
      } catch (err) {
        console.error("[QuickNote] persistDraft failed", err);
        setSaveStatus("error");
        return false;
      }
    },
    [
      db,
      userId,
      activeNoteRef,
      draftNoteIdRef,
      explicitEditRef,
      setDraftNoteId,
      setDraftDirty,
      beginDraftWrite,
      markDraftSaved,
    ],
  );

  const flushAutosave = useCallback(async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!dirtyRef.current) {
      return;
    }
    // Read the ref, NEVER state: edits write the ref synchronously while
    // setDraft commits on the next render, so state can still hold "" (or
    // older text) when this runs from unmount/pagehide/blur/rapid-close.
    const text = draftRef.current;
    setSaveStatus("saving");
    const ok = await persistDraft(text);
    // Preserve dirty only when there is actual unsaved content.
    setDraftDirty(ok ? false : draftRef.current !== baseTextRef.current);
  }, [persistDraft, dirtyRef, draftRef, baseTextRef, setDraftDirty]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void flushAutosave();
    }, 500);
  }, [flushAutosave]);

  // Flush on unmount (page navigation)
  useEffect(() => {
    return () => {
      void flushAutosave();
    };
  }, [flushAutosave]);

  // Flush on visibilitychange (hidden) and pagehide
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flushAutosave();
    };
    const handlePageHide = () => void flushAutosave();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushAutosave]);

  const updateText = useCallback(
    (text: string) => {
      const isDirty = editDraft("updateText", text);
      setSaveStatus((s) => {
        if (isDirty) return "editing";
        return s === "editing" ? "saved" : s;
      });
      // Lazily create note on first non-whitespace input
      if (text.trim().length > 0 && !activeNoteRef.current && !pendingNoteIdRef.current && userId) {
        pendingNoteIdRef.current = uuidv4();
        // The draft now belongs to the pending note, not to any active row.
        setDraftNoteId(pendingNoteIdRef.current);
      }
      scheduleAutosave();
    },
    [editDraft, setDraftNoteId, activeNoteRef, userId, scheduleAutosave],
  );

  const hasUnsaved = saveStatus === "editing" || saveStatus === "saving" || saveStatus === "error";

  return useMemo(
    () => ({
      saveStatus,
      lastSavedAt,
      hasUnsaved,
      pendingNoteIdRef,
      pendingInsertedRef,
      persistDraft,
      flushAutosave,
      scheduleAutosave,
      cancelAutosave,
      resetPending,
      markSaving,
      markIdle,
      markError,
      updateText,
    }),
    [
      saveStatus,
      lastSavedAt,
      hasUnsaved,
      persistDraft,
      flushAutosave,
      scheduleAutosave,
      cancelAutosave,
      resetPending,
      markSaving,
      markIdle,
      markError,
      updateText,
    ],
  );
}
