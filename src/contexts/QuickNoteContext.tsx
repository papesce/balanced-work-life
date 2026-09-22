"use client";

/**
 * QuickNoteContext
 *
 * Owns the current open note, panel open/close, global keyboard shortcut,
 * the heal step, autosave with debounce, and its own useUndoAction instance
 * with its own <UndoBar>.
 *
 * The textarea and line inputs are driven by local draft state, never
 * directly by the PowerSync query value. Incoming DB text is applied
 * only when the draft isn't dirty.
 *
 * Lazy note creation: the first non-whitespace input generates a client-side
 * UUID, keeps it in a ref, and INSERTs the row with the text in the same
 * statement. Subsequent flushes UPDATE by that id. This avoids losing text
 * when the DB insert hasn't landed yet.
 *
 * NOTE: useUndoAction is single-slot (last wins). Only the most recent
 * action is undoable. Acceptable for v1.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { QuickNote } from "@/lib/types";
import {
  parseNoteLines,
  markLineResolved,
  replaceLine,
  unresolvedNonEmptyCount,
} from "@/lib/quickNotes";
import { useUndoAction } from "@/lib/tasks/undo";
import { UndoBar } from "@/components/shared/UndoBar";
import { QuickNotePanel } from "@/components/quicknote/QuickNotePanel";

type ResolveAction =
  | { type: "create"; expectedText: string; text: string }
  | { type: "create_under"; expectedText: string; parentId: string; text: string }
  | { type: "match"; expectedText: string; ideaId: string }
  | { type: "discard"; expectedText: string };

export type QuickNotePanelMode = "capture" | "process" | "list";

/** Autosave feedback state for the quick-note editor. */
export type QuickNoteSaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

interface QuickNoteContextValue {
  note: QuickNote | null;
  loading: boolean;
  panelOpen: boolean;
  openPanel: (mode?: QuickNotePanelMode) => void;
  closePanel: () => void;
  /** Requested panel mode (consumed by the panel on open). Null = no request. */
  requestedMode: QuickNotePanelMode | null;
  consumeRequestedMode: () => void;
  /** Flush pending autosave immediately. Resolves after the write lands (or fails). */
  flushNow: (origin?: string) => Promise<void>;
  /** True while there are edits not yet confirmed persisted (drives close guards). */
  hasUnsaved: boolean;
  /** Update the full note text (capture mode). Creates the note lazily on first non-whitespace input. */
  updateText: (text: string) => void;
  /** Replace a single line's text and update the full draft. */
  updateLineText: (index: number, newText: string) => void;
  /** Resolve a single line. Runs in one writeTransaction. */
  resolveLine: (index: number, action: ResolveAction) => Promise<void>;
  /** Soft-delete the entire note. */
  discardNote: () => Promise<void>;
  /** Number of unresolved non-empty lines in the active note. */
  unreadCount: number;
  /** Total unresolved lines across all open notes. */
  totalUnreadCount: number;
  /** Undo bar state (owned by this context, not the page). */
  undoAction: ReturnType<typeof useUndoAction>["undoAction"];
  handleUndo: ReturnType<typeof useUndoAction>["handleUndo"];
  clearUndo: ReturnType<typeof useUndoAction>["clearUndo"];
  /** Current draft text (for Process mode to read). */
  draft: string;
  /** All quick notes (open + archived, excluding deleted). */
  allNotes: QuickNote[];
  /** All open notes, newest first. */
  openNotes: QuickNote[];
  /** The currently selected note in the panel (may be open or archived). */
  selectedNote: QuickNote | null;
  /** Select a note by id to view in the panel. Flushes dirty draft first. */
  selectNote: (id: string) => Promise<void>;
  /** Create a new blank open note and select it. Returns the new id. */
  createNote: () => Promise<string | null>;
  /** Whether the currently selected note is an open note (editable). */
  isSelectedNoteLive: boolean;
  /** Autosave feedback: current status + when the draft was last persisted. */
  saveStatus: QuickNoteSaveStatus;
  /** ISO timestamp of the last successful save (null until first save). */
  lastSavedAt: string | null;
}

const QuickNoteContext = createContext<QuickNoteContextValue | null>(null);

/** Temporary debug logging for the paste-not-saving investigation.
 *  Enable in the browser console with: localStorage.setItem("quicknote-debug", "1")
 *  Disable with: localStorage.removeItem("quicknote-debug") */
function qnDebug(...args: unknown[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage?.getItem("quicknote-debug") === "1") {
      console.log("[QuickNote]", ...args);
    }
  } catch {
    /* ignore (SSR / blocked storage) */
  }
}

/**
 * Keystroke logging: records WHAT changed on every edit (typed/removed
 * chars), so a wiped note can be proven to come (or not come) from the
 * textarea. Always on, truncated to 200 chars per side — filter the
 * DevTools console for `[QuickNote:input]`.
 */
function qnLogInput(caller: string, prev: string, next: string) {
  if (prev === next) {
    console.log(`[QuickNote:input] ${caller}: no change (len=${next.length})`);
    return;
  }
  // Diff via common prefix/suffix so we log the actual typed/removed chars.
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  const removed = prev.slice(start, endPrev).slice(0, 200);
  const added = next.slice(start, endNext).slice(0, 200);
  const parts: string[] = [];
  if (added.length > 0) parts.push(`typed ${JSON.stringify(added)}`);
  if (removed.length > 0) parts.push(`removed ${JSON.stringify(removed)}`);
  if (added.length === 0 && removed.length === 0)
    parts.push("change outside common diff (multiline edit)");
  console.log(
    `[QuickNote:input] ${caller}: len ${prev.length} → ${next.length} (${parts.join(", ")})`,
  );
}
/**
 * Save-query logging for the remote-sync investigation. Unlike qnDebug this
 * is ALWAYS on: quick-note writes are rare (debounced), so the noise is
 * minimal, and a missing log line directly tells you the write never ran.
 * Filter the DevTools console for `[QuickNote:sql]`.
 */
function qnLogQuery(
  outcome: "start" | "ok" | "fail",
  label: string,
  sql: string,
  params: unknown[],
) {
  const time = new Date().toISOString();
  if (outcome === "start") {
    console.log(
      `[QuickNote:sql] ${label} @ ${time}\n  SQL: ${sql}\n  params: ${JSON.stringify(params)?.slice(0, 500)}`,
    );
  } else if (outcome === "ok") {
    console.log(`[QuickNote:sql] ${label} OK @ ${time}`);
  } else {
    console.error(`[QuickNote:sql] ${label} FAILED @ ${time}`);
  }
}

export function useQuickNoteContext() {
  const ctx = useContext(QuickNoteContext);
  if (!ctx) throw new Error("useQuickNoteContext must be used within QuickNoteProvider");
  return ctx;
}

/** Insert an idea row using the same column set as useIdeas.createIdea. */
function insertIdea(
  tx: Parameters<Parameters<ReturnType<typeof usePowerSync>["writeTransaction"]>[0]>[0],
  opts: {
    userId: string;
    parentId: string | null;
    text: string;
    sortOrder: number;
    now: string;
  },
) {
  const id = uuidv4();
  return tx
    .execute(
      `INSERT INTO ideas (id, user_id, parent_id, text, description, type, effort, impact, urgency,
      scheduled_date, scheduled_time, duration_minutes, is_priority, priority_order,
      status, notes, completed_at, cancelled_at, paused_at, attempt_dates, status_history,
      horizon, focus_lane, in_focus, in_focus_until, productivity_signal, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        opts.userId,
        opts.parentId,
        opts.text,
        null,
        "idea",
        null,
        null,
        null,
        null,
        null,
        null,
        0,
        null,
        "draft",
        null,
        null,
        null,
        null,
        "[]",
        null,
        null,
        null,
        0,
        null,
        null,
        opts.sortOrder,
        opts.now,
        opts.now,
      ],
    )
    .then(() => id);
}

export function QuickNoteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  // ── Query the open note ──────────────────────────────────────────
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM quick_notes WHERE user_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY updated_at DESC"
      : "SELECT * FROM quick_notes WHERE 0",
    userId ? [userId] : [],
  );

  const openNotes: QuickNote[] = useMemo(() => {
    const rows = ((rawRows as unknown as QuickNote[]) ?? []).map((r) => ({ ...r }));
    return rows.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        b.id.localeCompare(a.id),
    );
  }, [rawRows]);

  // Multiple open notes are intentional (explicit + New note button).
  // No auto-merge: each note lives until fully processed → archived.

  // ── Query all notes (open + archived) for the list view ──────────
  const { data: allRawRows } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM quick_notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC"
      : "SELECT * FROM quick_notes WHERE 0",
    userId ? [userId] : [],
  );

  const allNotes: QuickNote[] = useMemo(() => {
    const rows = ((allRawRows as unknown as QuickNote[]) ?? []).map((r) => ({ ...r }));
    return rows.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        b.id.localeCompare(a.id),
    );
  }, [allRawRows]);

  // ── Selected note for browsing ───────────────────────────────────
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const latestOpenNote = openNotes[0] ?? null;

  const selectedNote = useMemo(() => {
    const id = selectedNoteId ?? latestOpenNote?.id;
    if (!id) return latestOpenNote;
    return allNotes.find((n) => n.id === id) ?? latestOpenNote;
  }, [selectedNoteId, allNotes, latestOpenNote]);

  // Active note = selected note when it is open, else the latest open note.
  // All editing/processing operates on the active note so each note can be
  // processed as usual.
  const note = selectedNote?.status === "open" ? selectedNote : latestOpenNote;

  const isSelectedNoteLive = selectedNote?.status === "open";

  // ── Local draft state ────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const dirtyRef = useRef(false);
  const writingRef = useRef(false);
  const lastWrittenRef = useRef<string | null>(null);

  // NOTE: there used to be a `getDraft()` state getter here for flushAutosave.
  // It was removed on purpose: state lags behind keystrokes until the next
  // render commits, so any flush running before that (unmount, pagehide,
  // blur, rapid close) persisted STALE text — including "" over real content.
  // draftRef is updated synchronously in updateText/updateLineText and is the
  // only source flushes may read.

  // Keep the mutable ref in sync with state so writeTransactions never
  // operate on a stale ("") draft — previously draftRef was only updated
  // on edits, so a freshly loaded note resolved via Match/Create silently
  // no-oped (target not found in "").
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Sync draft from DB only when not dirty AND not waiting for a write to land.
  // Without the writingRef guard, PowerSync can re-emit the query with stale text
  // before the write completes, overwriting the user's edits.
  // When the DB text matches what we last wrote, the write has landed — clear writingRef.
  // Depends only on note?.id: runs when switching notes (initial load, selection change).
  // External text updates to the same note are ignored while the user is editing —
  // the next save/selection switch will pick them up.
  const prevNoteIdRef = useRef<string | null>(null);
  // ── Draft provenance ─────────────────────────────────────────────
  // Which note the draft belongs to, what its text was at the last
  // save/load/switch (base), and whether the user explicitly edited since.
  // Prevents flushing one note's draft into another note's row, and
  // prevents a spuriously-set dirty flag from wiping real content.
  const draftNoteIdRef = useRef<string | null>(null);
  const baseTextRef = useRef("");
  const explicitEditRef = useRef(false);
  useEffect(() => {
    const currentId = note?.id ?? null;
    if (currentId === prevNoteIdRef.current) return;
    qnDebug("draft-sync: note switch", {
      prevId: prevNoteIdRef.current,
      currentId,
      dbTextLength: note?.text?.length ?? 0,
      dirty: dirtyRef.current,
      writing: writingRef.current,
    });
    prevNoteIdRef.current = currentId;

    if (writingRef.current) {
      if (note?.text === lastWrittenRef.current) {
        writingRef.current = false;
      }
      return;
    }
    if (!dirtyRef.current) {
      const dbText = note?.text ?? "";
      console.log(
        `[QuickNote:sql] draft-sync: loading draft len=${dbText.length} for note ${currentId ?? "(none)"} from DB row`,
      );
      setDraft(dbText);
      draftRef.current = dbText;
      draftNoteIdRef.current = currentId;
      baseTextRef.current = dbText;
      explicitEditRef.current = false;
    } else {
      console.warn(
        `[QuickNote:sql] draft-sync: note switch to ${currentId ?? "(none)"} skipped — draft is dirty (len=${draftRef.current.length}, base len=${baseTextRef.current.length})`,
      );
    }
    // note?.text is tracked so the effect runs when DB text changes, but the
    // prevNoteIdRef guard ensures the body only executes on note ID transitions.
  }, [note?.id, note?.text]);

  // selectNote / createNote are defined after autosave refs below
  // (they flush the dirty draft before switching notes).

  // ── Lazy note creation refs ──────────────────────────────────────
  // On first non-whitespace input, generate id client-side, INSERT with text.
  // Subsequent flushes UPDATE by pendingNoteId once the INSERT has landed
  // (tracked by pendingInsertedRef so we never double-INSERT the same id).
  const pendingNoteIdRef = useRef<string | null>(null);
  const pendingInsertedRef = useRef(false);

  // ── Panel state ──────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

  // ── Autosave ─────────────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<QuickNoteSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  // When switching to a note with no local edits, the persisted
  // `updated_at` is the last-saved time — the indicator falls back to it
  // while saveStatus is idle (no edits yet this session).

  /**
   * Persist `text` for the active-or-pending note. Truthful: the dirty flag
   * is only cleared after the write succeeds, so a failed flush retries
   * instead of silently dropping text. Returns true on success / nothing
   * to do, false on failure.
   */
  const persistText = useCallback(
    async (text: string, origin = "unknown"): Promise<boolean> => {
      const existingNote = noteRef.current;
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
        const ms = Date.now() - startedAt;
        if (!ok) {
          console.error(
            `[QuickNote:sql] ${label} FAILED after ${ms}ms — will retry, text kept dirty`,
          );
          return;
        }
        // Immediate snapshot is provisional: the uploader cycle may not have
        // run yet, so PENDING here is often transient noise. The 5s re-check
        // below is the real verdict — if it still says PENDING, the upload
        // is stuck (see the `upload <table> … FAILED` line for why).
        const immediate = await checkQueue();
        console.log(
          `[QuickNote:sql] ${label} OK in ${ms}ms (local write). Upload queue (immediate): ${immediate}.`,
        );
        setTimeout(() => {
          void checkQueue().then((later) => {
            if (later.startsWith("PENDING")) {
              console.error(
                `[QuickNote:sql] ${label}: upload queue STILL PENDING 5s after local write — upload is stuck. Look for an 'upload <table> … FAILED' line above.`,
              );
            } else {
              console.log(`[QuickNote:sql] ${label}: upload queue after 5s: ${later}.`);
            }
          });
        }, 5000);
      };
      try {
        // Resolve the write target from draft provenance, NOT from whatever
        // note happens to be active: the draft may belong to a different
        // (e.g. archived, browsed) note than the active one, and flushing it
        // into the active row would be a cross-note overwrite.
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
            // No target yet (e.g. note was discarded mid-typing): mint an id now
            // rather than dropping the text.
            const id = uuidv4();
            pendingNoteIdRef.current = id;
            draftNoteIdRef.current = id;
            writingRef.current = true;
            lastWrittenRef.current = text;
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
            baseTextRef.current = text;
            explicitEditRef.current = false;
            finish(true, `INSERT quick_notes (recovered) id=${id}`);
          } else if (draftNoteId) {
            // Draft belongs to a note that is neither active nor pending
            // (e.g. an archived note being viewed). Refuse rather than
            // writing one note's text into another note's row.
            console.error(
              `[QuickNote:sql] [${origin}] persistText REFUSED: draft belongs to note ${draftNoteId} ` +
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
          // A spuriously-set dirty flag (failed-save residue, stale state)
          // must not wipe real content.
          if (text.length === 0 && !explicitEditRef.current) {
            const rows = await db.getAll<{ text: string }>(
              "SELECT text FROM quick_notes WHERE id = ?",
              [target.id],
            );
            const dbText = rows[0]?.text ?? "";
            if (dbText.length > 0) {
              console.warn(
                `[QuickNote:sql] [${origin}] persistText SKIPPED: refusing to overwrite ${dbText.length} chars with "" (no explicit edit since base was set). Clearing spurious dirty flag.`,
              );
              dirtyRef.current = false;
              return true;
            }
          }
          writingRef.current = true;
          lastWrittenRef.current = text;
          qnDebug("flush: UPDATE", { id: target.id, textLength: text.length, now });
          const params = [text, now, target.id];
          qnLogQuery(
            "start",
            `[${origin}] UPDATE quick_notes id=${target.id} len=${text.length}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          finish(true, `UPDATE quick_notes id=${target.id}`);
        } else {
          // target.kind === "pending"
          const pendingId = target.id;
          if (pendingInsertedRef.current) {
            writingRef.current = true;
            lastWrittenRef.current = text;
            qnDebug("flush: UPDATE pending", { id: pendingId, textLength: text.length, now });
            const params = [text, now, pendingId];
            qnLogQuery(
              "start",
              `[${origin}] UPDATE quick_notes (pending) id=${pendingId} len=${text.length}`,
              "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
              params,
            );
            await db.execute(
              "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
              params,
            );
            finish(true, `UPDATE quick_notes (pending) id=${pendingId}`);
          } else {
            writingRef.current = true;
            lastWrittenRef.current = text;
            qnDebug("flush: INSERT", { id: pendingId, textLength: text.length, now });
            const params = [pendingId, userId, text, "open", now, now];
            qnLogQuery(
              "start",
              `[${origin}] INSERT quick_notes id=${pendingId} len=${text.length}`,
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            await db.execute(
              "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
              params,
            );
            pendingInsertedRef.current = true;
            finish(true, `INSERT quick_notes id=${pendingId}`);
          }
        }
        qnDebug("flush: success", { now });
        baseTextRef.current = text;
        explicitEditRef.current = false;
        setLastSavedAt(now);
        setSaveStatus("saved");
        return true;
      } catch (err) {
        qnDebug("flush: FAILED", err);
        console.error("[QuickNote:sql] persistText FAILED", err);
        setSaveStatus("error");
        return false;
      }
    },
    [db, userId],
  );

  const flushAutosave = useCallback(
    async (origin = "unknown") => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (!dirtyRef.current) {
        qnDebug("flush: skipped (not dirty)");
        return;
      }
      // Read the ref, NEVER state: updateText/updateLineText write the ref
      // synchronously while setDraft commits on the next render, so state can
      // still hold "" (or older text) when this runs from unmount/pagehide/
      // blur/rapid-close — flushing that would lose keystrokes or wipe content.
      const text = draftRef.current;
      qnDebug("flush: start", {
        origin,
        textLength: text.length,
        preview: text.slice(0, 200),
        existingNoteId: noteRef.current?.id ?? null,
        pendingId: pendingNoteIdRef.current,
      });

      setSaveStatus("saving");
      const ok = await persistText(text, origin);
      if (!ok) {
        // Keep dirty=true so the text survives panel close and retries —
        // but only when there is actual unsaved content (see truthful dirty
        // in updateText/updateLineText).
        dirtyRef.current = draftRef.current !== baseTextRef.current;
      } else {
        dirtyRef.current = false;
      }
    },
    [persistText],
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

  // ── Keyboard shortcut: Cmd/Ctrl + Alt + N ───────────────────────
  // Cmd+Shift+N is taken by Chrome/Safari (incognito window).
  // Cmd+Alt+N has NOT been verified in a real browser.
  // Alternatives considered: Cmd+Shift+M (conflicts with Gmail compose),
  // Cmd+Ctrl+N (not standard on macOS), Cmd+Alt+Q (unfamiliar).
  // event.code is used because Option (Alt) changes event.key on macOS.
  // Shortcuts registered only when user is authenticated.
  useEffect(() => {
    if (!user) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyN" && (e.metaKey || e.ctrlKey) && e.altKey) {
        e.preventDefault();
        setPanelOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [user]);

  // ── Panel open/close ─────────────────────────────────────────────
  const [requestedMode, setRequestedMode] = useState<QuickNotePanelMode | null>(null);
  const openPanel = useCallback((mode?: QuickNotePanelMode) => {
    if (mode) setRequestedMode(mode);
    else setRequestedMode(null);
    setPanelOpen(true);
  }, []);
  const consumeRequestedMode = useCallback(() => setRequestedMode(null), []);
  const closePanel = useCallback(async () => {
    // Await the flush so the last ~500ms of typing isn't lost behind the
    // unmount. On failure dirtyRef stays true and the draft survives in
    // provider state, so reopening shows the unsaved text.
    await flushAutosave("close");
    setPanelOpen(false);
  }, [flushAutosave]);

  // ── Select / create notes ──────────────────────────────────────────
  // Both flush the dirty draft to the previously active note first so
  // switching never loses typed text. The switch is aborted when the
  // flush fails, keeping the user's text in place.
  const selectNote = useCallback(
    async (id: string) => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      if (dirtyRef.current) {
        setSaveStatus("saving");
        const ok = await persistText(draftRef.current, "select");
        // Preserve dirty only when there is actual unsaved content —
        // never resurrect a stale flag with an empty/equal draft.
        dirtyRef.current = ok ? false : draftRef.current !== baseTextRef.current;
        if (!ok) return;
      } else {
        dirtyRef.current = false;
      }
      setSelectedNoteId(id);
      const target = allNotes.find((n) => n.id === id);
      if (target) {
        console.log(
          `[QuickNote:sql] selectNote: switching to id=${id}, setting draft len=${target.text?.length ?? 0} from DB row`,
        );
        setDraft(target.text);
        draftRef.current = target.text;
        draftNoteIdRef.current = target.id;
        baseTextRef.current = target.text;
        explicitEditRef.current = false;
        setLastSavedAt(target.updated_at ?? null);
        setSaveStatus("idle");
      } else {
        console.warn(
          `[QuickNote:sql] selectNote: id=${id} NOT FOUND in allNotes (${allNotes.length} rows) — draft left untouched (len=${draftRef.current.length})`,
        );
      }
    },
    [allNotes, persistText],
  );

  const createNote = useCallback(async () => {
    if (!userId) return null;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (dirtyRef.current) {
      // Persist pending text (existing row UPDATE or pending INSERT) before
      // abandoning it — previously this path only handled existing rows and
      // silently dropped not-yet-saved typing.
      setSaveStatus("saving");
      const ok = await persistText(draftRef.current, "create");
      dirtyRef.current = ok ? false : draftRef.current !== baseTextRef.current;
      if (!ok) return null;
    } else {
      dirtyRef.current = false;
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    try {
      const params = [id, userId, "", "open", now, now];
      qnLogQuery(
        "start",
        `createNote: blank note id=${id}`,
        "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        params,
      );
      await db.execute(
        "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        params,
      );
      qnLogQuery("ok", "createNote: blank note", "", []);
    } catch (err) {
      qnDebug("createNote: FAILED", err);
      setSaveStatus("error");
      dirtyRef.current = draftRef.current !== baseTextRef.current;
      return null;
    }
    pendingNoteIdRef.current = null;
    pendingInsertedRef.current = false;
    writingRef.current = false;
    lastWrittenRef.current = null;
    setSelectedNoteId(id);
    setDraft("");
    draftRef.current = "";
    draftNoteIdRef.current = id;
    baseTextRef.current = "";
    explicitEditRef.current = false;
    setLastSavedAt(null);
    setSaveStatus("idle");
    return id;
  }, [db, userId, persistText]);

  // ── Text update (capture mode) ───────────────────────────────────
  const updateText = useCallback(
    (text: string) => {
      const prev = draftRef.current;
      qnLogInput("updateText", prev, text);
      draftRef.current = text;
      setDraft(text);
      explicitEditRef.current = true;
      // Truthful dirty: typing back to exactly what's saved means there is
      // nothing unsaved — don't leave a stale dirty flag that later flushes
      // (and, combined with the draft-sync guard, not even an empty string
      // the user didn't type).
      const isDirty = text !== baseTextRef.current;
      dirtyRef.current = isDirty;
      setSaveStatus((s) => {
        if (isDirty) return "editing";
        return s === "editing" ? "saved" : s;
      });
      qnDebug("updateText", {
        textLength: text.length,
        preview: text.slice(0, 200),
        hasNote: !!noteRef.current,
        pendingId: pendingNoteIdRef.current,
      });
      // Lazily create note on first non-whitespace input
      if (text.trim().length > 0 && !noteRef.current && !pendingNoteIdRef.current && userId) {
        pendingNoteIdRef.current = uuidv4();
        // The draft now belongs to the pending note, not to any active row.
        draftNoteIdRef.current = pendingNoteIdRef.current;
      }
      scheduleAutosave();
    },
    [scheduleAutosave, userId],
  );

  // ── Replace a single line's text (process mode) ──────────────────
  const updateLineText = useCallback(
    (index: number, newText: string) => {
      const prev = draftRef.current;
      const nextText = replaceLine(prev, index, newText);
      qnLogInput(`updateLineText line ${index}`, prev, nextText);
      explicitEditRef.current = true;
      const isDirty = nextText !== baseTextRef.current;
      dirtyRef.current = isDirty;
      setSaveStatus((s) => {
        if (isDirty) return "editing";
        return s === "editing" ? "saved" : s;
      });
      draftRef.current = nextText;
      setDraft(nextText);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // ── Resolve a line ───────────────────────────────────────────────
  const resolveLine = useCallback(
    async (index: number, action: ResolveAction) => {
      if (!note) return;

      // Validate BEFORE flushing: previously the dirty draft was flushed as
      // statement 1 of the transaction and then a missing/already-resolved
      // line caused an early return with dirty=false — a silent no-op that
      // also left save state inconsistent.
      const preLines = parseNoteLines(draftRef.current);
      const preTarget = preLines.find((l) => l.index === index);
      if (!preTarget || preTarget.resolved) return;

      let resultText: string | null = null;
      let didArchive = false;
      let ideaIdToDelete: string | null = null;

      await db.writeTransaction(async (tx) => {
        // 1. Flush the draft into the note as the first statement
        if (dirtyRef.current) {
          const now = new Date().toISOString();
          const params = [draftRef.current, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: flush draft id=${note.id} len=${draftRef.current.length}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          qnLogQuery("ok", "resolveLine: flush draft", "", []);
          dirtyRef.current = false;
        }

        // 2. Use the current draft directly (avoids stale read from DB)
        const currentText = draftRef.current;

        const lines = parseNoteLines(currentText);
        const target = lines.find((l) => l.index === index);

        // 3. Guard: line missing or already resolved (re-checked post-flush
        // to cover races with concurrent edits; the pre-transaction check
        // above handles the common case without touching dirty state).
        // NOTE: the old strict `target.text !== expectedText` check caused
        // silent no-ops (notably on the last line) when the row's prop was
        // stale vs. the flushed draft. The draft is authoritative — proceed
        // with the current text and only warn on mismatch.
        if (!target || target.resolved) return;
        if (target.text !== action.expectedText) {
          console.warn("[QuickNote] resolveLine text mismatch — proceeding with current draft", {
            index,
            expected: action.expectedText,
            actual: target.text,
          });
        }

        // 4. Side effects
        if (action.type === "create" || action.type === "create_under") {
          const parentId = action.type === "create_under" ? action.parentId : null;
          const maxRow = await tx.getAll<{ max_order: number | null }>(
            "SELECT MAX(sort_order) AS max_order FROM ideas WHERE user_id = ? AND parent_id IS ?",
            [userId, parentId],
          );
          const sortOrder = (maxRow[0]?.max_order ?? -1) + 1;
          const now = new Date().toISOString();
          const id = await insertIdea(tx, {
            userId,
            parentId,
            text: action.text.trim(),
            sortOrder,
            now,
          });
          ideaIdToDelete = id;
        }

        // 5. Mark line resolved
        const matchedId = action.type === "match" ? action.ideaId : undefined;
        const newText = markLineResolved(currentText, index, matchedId);
        const now = new Date().toISOString();

        // 6. Check if any unresolved non-empty lines remain
        const remaining = unresolvedNonEmptyCount(newText);
        const hasResolved = parseNoteLines(newText).some((l) => l.resolved);

        if (remaining === 0 && hasResolved) {
          didArchive = true;
          const params = [newText, now, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: ARCHIVE note id=${note.id}`,
            "UPDATE quick_notes SET text = ?, status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute(
            "UPDATE quick_notes SET text = ?, status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
            params,
          );
          qnLogQuery("ok", "resolveLine: ARCHIVE note", "", []);
        } else {
          const params = [newText, now, note.id];
          qnLogQuery(
            "start",
            `resolveLine: mark line ${index} resolved id=${note.id} action=${action.type}`,
            "UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?",
            params,
          );
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", params);
          qnLogQuery("ok", "resolveLine: mark line resolved", "", []);
        }

        resultText = newText;
      });

      // 7. Only update draft if the transaction succeeded
      if (resultText !== null) {
        dirtyRef.current = false;
        draftRef.current = resultText;
        setDraft(resultText);
        draftNoteIdRef.current = note.id;
        baseTextRef.current = resultText;
        explicitEditRef.current = false;

        // 8. Register undo — ONE writeTransaction
        const capturedNoteId = note.id;
        const capturedIdeaId = ideaIdToDelete;
        const capturedIndex = index;
        const capturedDidArchive = didArchive;
        const undoLabel = didArchive
          ? "Note archived"
          : action.type === "create" || action.type === "create_under"
            ? "Idea created"
            : action.type === "match"
              ? "Idea matched"
              : "Line discarded";

        registerUndo({
          label: undoLabel,
          run: async () => {
            await db.writeTransaction(async (uTx) => {
              const uRows = await uTx.getAll<{ text: string; status: string }>(
                "SELECT text, status FROM quick_notes WHERE id = ?",
                [capturedNoteId],
              );
              if (uRows.length === 0) return;
              const uText = uRows[0].text;
              const uLines = uText.split("\n");
              const uLine = uLines[capturedIndex];
              // Only remove prefix if the line still starts with it
              // Handles both "✓ text" and "✓ [matched:id] text"
              if (uLine && uLine.startsWith("✓ ")) {
                const afterCheck = uLine.slice(2);
                const tagMatch = afterCheck.match(/^\[matched:[^\]]+\]\s*/);
                uLines[capturedIndex] = tagMatch
                  ? afterCheck.slice(tagMatch[0].length)
                  : afterCheck;
              }
              const now = new Date().toISOString();
              if (capturedDidArchive) {
                await uTx.execute(
                  "UPDATE quick_notes SET text = ?, status = 'open', archived_at = NULL, updated_at = ? WHERE id = ?",
                  [uLines.join("\n"), now, capturedNoteId],
                );
              } else {
                await uTx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
                  uLines.join("\n"),
                  now,
                  capturedNoteId,
                ]);
              }
            });
            // Delete created idea (outside transaction)
            if (capturedIdeaId) {
              await db.execute("DELETE FROM ideas WHERE id = ?", [capturedIdeaId]);
            }
          },
        });
      }
    },
    [note, db, userId, registerUndo],
  );

  // ── Discard note ─────────────────────────────────────────────────
  // Clears any pending autosave first: previously a dirty draft (<500ms old)
  // would be flushed AFTER the soft-delete by closePanel, resurrecting text
  // on a deleted row or orphan-INSERTing. A never-persisted pending note is
  // simply dropped locally with no DB write and no undo needed.
  const discardNote = useCallback(async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const existing = noteRef.current;
    if (!existing) {
      pendingNoteIdRef.current = null;
      pendingInsertedRef.current = false;
      dirtyRef.current = false;
      writingRef.current = false;
      lastWrittenRef.current = null;
      setDraft("");
      draftRef.current = "";
      draftNoteIdRef.current = null;
      baseTextRef.current = "";
      explicitEditRef.current = false;
      setSaveStatus("idle");
      return;
    }
    const capturedNoteId = existing.id;
    const now = new Date().toISOString();
    const discardParams = [now, now, capturedNoteId];
    qnLogQuery(
      "start",
      `discardNote: soft-delete id=${capturedNoteId}`,
      "UPDATE quick_notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
      discardParams,
    );
    await db.execute(
      "UPDATE quick_notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
      discardParams,
    );
    qnLogQuery("ok", "discardNote: soft-delete", "", []);
    // Drop local edit state AFTER the delete so a trailing flush can't
    // resurrect the row. Undo restores the last-saved text, not the
    // unsaved keystrokes — the confirm step in the panel makes this explicit.
    dirtyRef.current = false;
    pendingNoteIdRef.current = null;
    pendingInsertedRef.current = false;
    writingRef.current = false;
    lastWrittenRef.current = null;
    draftNoteIdRef.current = null;
    baseTextRef.current = "";
    explicitEditRef.current = false;
    registerUndo({
      label: "Note discarded",
      run: async () => {
        await db.execute(
          "UPDATE quick_notes SET deleted_at = NULL, status = 'open', updated_at = ? WHERE id = ?",
          [new Date().toISOString(), capturedNoteId],
        );
      },
    });
  }, [db, registerUndo]);

  // ── Derived values ───────────────────────────────────────────────
  const hasUnsaved = saveStatus === "editing" || saveStatus === "saving" || saveStatus === "error";
  const unreadCount = useMemo(
    () => (note ? unresolvedNonEmptyCount(draft || note.text) : 0),
    [note, draft],
  );
  const totalUnreadCount = useMemo(
    () =>
      openNotes.reduce(
        (sum, n) => sum + unresolvedNonEmptyCount(n.id === note?.id ? draft || n.text : n.text),
        0,
      ),
    [openNotes, note?.id, draft],
  );

  // ── Context value ────────────────────────────────────────────────
  const value: QuickNoteContextValue = useMemo(
    () => ({
      note,
      loading: isLoading,
      panelOpen,
      openPanel,
      closePanel,
      requestedMode,
      consumeRequestedMode,
      flushNow: flushAutosave,
      updateText,
      updateLineText,
      resolveLine,
      discardNote,
      unreadCount,
      totalUnreadCount,
      undoAction,
      handleUndo,
      clearUndo,
      draft,
      allNotes,
      openNotes,
      selectedNote,
      selectNote,
      createNote,
      isSelectedNoteLive,
      saveStatus,
      hasUnsaved,
      lastSavedAt,
    }),
    [
      note,
      isLoading,
      panelOpen,
      openPanel,
      closePanel,
      requestedMode,
      consumeRequestedMode,
      flushAutosave,
      updateText,
      updateLineText,
      resolveLine,
      discardNote,
      unreadCount,
      totalUnreadCount,
      undoAction,
      handleUndo,
      clearUndo,
      draft,
      allNotes,
      openNotes,
      selectedNote,
      selectNote,
      createNote,
      isSelectedNoteLive,
      saveStatus,
      hasUnsaved,
      lastSavedAt,
    ],
  );

  return (
    <QuickNoteContext.Provider value={value}>
      {children}
      <UndoBar undoAction={undoAction} onUndo={() => void handleUndo()} onDismiss={clearUndo} />
      {user && <QuickNotePanel />}
    </QuickNoteContext.Provider>
  );
}
