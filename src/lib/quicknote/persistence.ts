"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { replaceLine } from "@/lib/quickNotes";
import type { QuickNote } from "@/lib/types";
import type { QuickNoteFlushOrigin, QuickNoteSaveStatus } from "./types";
import type { QuickNoteDraftApi } from "./draft";
import { qnDebug, qnLogQuery, qnWarn, qnError, qnInfo, qnLoggingEnabled } from "./log";

export interface QuickNotePersistence {
  saveStatus: QuickNoteSaveStatus;
  lastSavedAt: string | null;
  hasUnsaved: boolean;
  pendingNoteIdRef: React.MutableRefObject<string | null>;
  pendingInsertedRef: React.MutableRefObject<boolean>;
  /** THE single write path: every flush funnels through here. */
  persistDraft: (text: string, origin?: QuickNoteFlushOrigin) => Promise<boolean>;
  flushAutosave: (origin?: QuickNoteFlushOrigin) => Promise<void>;
  scheduleAutosave: () => void;
  cancelAutosave: () => void;
  resetPending: () => void;
  markSaving: () => void;
  markIdle: (savedAt: string | null) => void;
  markError: () => void;
  updateText: (text: string) => void;
  updateLineText: (index: number, newText: string) => void;
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
    async (text: string, origin: QuickNoteFlushOrigin = "unknown"): Promise<boolean> => {
      const existingNote = activeNoteRef.current;
      const pendingId = pendingNoteIdRef.current;
      const now = new Date().toISOString();
      const startedAt = Date.now();

      const checkQueue = async (): Promise<string> => {
        try {
          const batch = await db.getCrudBatch();
          return batch == null
            ? "empty (upload caught up)"
            : "PENDING (local write awaiting upload)";
        } catch (e) {
          return `unreadable (${e instanceof Error ? e.message : String(e)})`;
        }
      };
      const finish = async (ok: boolean, label: string) => {
        if (!ok) {
          qnError(
            `${label} FAILED after ${Date.now() - startedAt}ms — will retry, text kept dirty`,
          );
          return;
        }
        if (!qnLoggingEnabled()) return;
        // Immediate snapshot is provisional: the uploader cycle may not have
        // run yet, so PENDING here is often transient noise. The 5s re-check
        // is the real verdict.
        const immediate = await checkQueue();
        qnInfo(
          `${label} OK in ${Date.now() - startedAt}ms (local write). Upload queue (immediate): ${immediate}.`,
        );
        setTimeout(() => {
          void checkQueue().then((later) => {
            if (later.startsWith("PENDING")) {
              qnError(
                `${label}: upload queue STILL PENDING 5s after local write — upload is stuck. Look for an 'upload <table> … FAILED' line above.`,
              );
            } else {
              qnInfo(`${label}: upload queue after 5s: ${later}.`);
            }
          });
        }, 5000);
      };

      try {
        // Resolve the write target from draft provenance, NOT from whatever
        // note happens to be active: the draft may belong to a different
        // (e.g. archived, browsed) note, and flushing it into the active row
        // would be a cross-note overwrite.
        const draftNoteId = draft.draftNoteIdRef.current;
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
            draft.setNoteId(id);
            draft.beginWrite(text);
            qnDebug("flush: INSERT (recovered, no target)", { id, textLength: text.length, now });
            const params = [id, userId, text, "open", now, now];
            qnLogQuery(
              "start",
              `[${origin}] INSERT quick_notes (recovered) id=${id} len=${text.length}`,
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            await db.execute(
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            pendingInsertedRef.current = true;
            draft.markSaved(text);
            void finish(true, `INSERT quick_notes (recovered) id=${id}`);
          } else if (draftNoteId) {
            // Draft belongs to a note that is neither active nor pending.
            // Refuse rather than writing one note's text into another's row.
            qnError(
              `[${origin}] persistDraft REFUSED: draft belongs to note ${draftNoteId} ` +
                `but active=${existingNote?.id ?? "(none)"} pending=${pendingId ?? "(none)"} — keeping dirty to avoid a cross-note overwrite.`,
            );
            return false;
          } else {
            qnDebug("flush: no target and empty text — nothing to persist");
            return true;
          }
          qnDebug("flush: success", { now });
          setLastSavedAt(now);
          setSaveStatus("saved");
          return true;
        }

        if (target.kind === "existing") {
          // Empty-overwrite guard: never blank a non-empty row unless the
          // user explicitly edited the text to empty after the base was set.
          if (text.length === 0 && !draft.explicitEditRef.current) {
            const rows = await db.getAll<{ text: string }>(
              "SELECT text FROM quick_notes WHERE id = ?",
              [target.id],
            );
            const dbText = rows[0]?.text ?? "";
            if (dbText.length > 0) {
              qnWarn(
                `[${origin}] persistDraft SKIPPED: refusing to overwrite ${dbText.length} chars with "" (no explicit edit since base was set). Clearing spurious dirty flag.`,
              );
              draft.setDirty(false);
              return true;
            }
          }
          draft.beginWrite(text);
          qnDebug("flush: UPDATE", { id: target.id, textLength: text.length, now });
          const params = [text, now, target.id];
          qnLogQuery(
            "start",
            `[${origin}] UPDATE quick_notes id=${target.id} len=${text.length}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          void finish(true, `UPDATE quick_notes id=${target.id}`);
        } else {
          const targetPendingId = target.id;
          if (pendingInsertedRef.current) {
            draft.beginWrite(text);
            qnDebug("flush: UPDATE pending", { id: targetPendingId, textLength: text.length, now });
            const params = [text, now, targetPendingId];
            qnLogQuery(
              "start",
              `[${origin}] UPDATE quick_notes (pending) id=${targetPendingId} len=${text.length}`,
              "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
              params,
            );
            await db.execute(
              "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
              params,
            );
            void finish(true, `UPDATE quick_notes (pending) id=${targetPendingId}`);
          } else {
            draft.beginWrite(text);
            qnDebug("flush: INSERT", { id: targetPendingId, textLength: text.length, now });
            const params = [targetPendingId, userId, text, "open", now, now];
            qnLogQuery(
              "start",
              `[${origin}] INSERT quick_notes id=${targetPendingId} len=${text.length}`,
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            await db.execute(
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            pendingInsertedRef.current = true;
            void finish(true, `INSERT quick_notes id=${targetPendingId}`);
          }
        }
        qnDebug("flush: success", { now });
        draft.markSaved(text);
        setLastSavedAt(now);
        setSaveStatus("saved");
        return true;
      } catch (err) {
        qnDebug("flush: FAILED", err);
        qnError("persistDraft FAILED", err);
        setSaveStatus("error");
        return false;
      }
    },
    [db, userId, draft, activeNoteRef],
  );

  const flushAutosave = useCallback(
    async (origin: QuickNoteFlushOrigin = "unknown") => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (!draft.dirtyRef.current) {
        qnDebug("flush: skipped (not dirty)");
        return;
      }
      // Read the ref, NEVER state: edits write the ref synchronously while
      // setDraft commits on the next render, so state can still hold "" (or
      // older text) when this runs from unmount/pagehide/blur/rapid-close.
      const text = draft.draftRef.current;
      qnDebug("flush: start", {
        origin,
        textLength: text.length,
        preview: text.slice(0, 200),
        existingNoteId: activeNoteRef.current?.id ?? null,
        pendingId: pendingNoteIdRef.current,
      });

      setSaveStatus("saving");
      const ok = await persistDraft(text, origin);
      // Preserve dirty only when there is actual unsaved content.
      draft.setDirty(ok ? false : draft.draftRef.current !== draft.baseTextRef.current);
    },
    [persistDraft, draft, activeNoteRef],
  );

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void flushAutosave("timer");
    }, 500);
  }, [flushAutosave]);

  // Flush on unmount (page navigation)
  useEffect(() => {
    return () => {
      void flushAutosave("unmount");
    };
  }, [flushAutosave]);

  // Flush on visibilitychange (hidden) and pagehide
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flushAutosave("visibility:hidden");
    };
    const handlePageHide = () => void flushAutosave("pagehide");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushAutosave]);

  const updateText = useCallback(
    (text: string) => {
      const isDirty = draft.edit("updateText", text);
      setSaveStatus((s) => {
        if (isDirty) return "editing";
        return s === "editing" ? "saved" : s;
      });
      qnDebug("updateText", {
        textLength: text.length,
        preview: text.slice(0, 200),
        hasNote: !!activeNoteRef.current,
        pendingId: pendingNoteIdRef.current,
      });
      // Lazily create note on first non-whitespace input
      if (text.trim().length > 0 && !activeNoteRef.current && !pendingNoteIdRef.current && userId) {
        pendingNoteIdRef.current = uuidv4();
        // The draft now belongs to the pending note, not to any active row.
        draft.setNoteId(pendingNoteIdRef.current);
      }
      scheduleAutosave();
    },
    [draft, activeNoteRef, userId, scheduleAutosave],
  );

  const updateLineText = useCallback(
    (index: number, newText: string) => {
      const nextText = replaceLine(draft.draftRef.current, index, newText);
      const isDirty = draft.edit(`updateLineText line ${index}`, nextText);
      setSaveStatus((s) => {
        if (isDirty) return "editing";
        return s === "editing" ? "saved" : s;
      });
      scheduleAutosave();
    },
    [draft, scheduleAutosave],
  );

  const hasUnsaved = saveStatus === "editing" || saveStatus === "saving" || saveStatus === "error";

  return {
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
    updateLineText,
  };
}
