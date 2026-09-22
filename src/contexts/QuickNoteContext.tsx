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

interface QuickNoteContextValue {
  note: QuickNote | null;
  loading: boolean;
  panelOpen: boolean;
  openPanel: (mode?: QuickNotePanelMode) => void;
  closePanel: () => void;
  /** Requested panel mode (consumed by the panel on open). Null = no request. */
  requestedMode: QuickNotePanelMode | null;
  consumeRequestedMode: () => void;
  /** Flush pending autosave immediately. */
  flushNow: () => void;
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
}

const QuickNoteContext = createContext<QuickNoteContextValue | null>(null);

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

  // Getter for the latest draft value (avoids stale closures in flushAutosave)
  const getDraft = useCallback(() => draft, [draft]);

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
  useEffect(() => {
    const currentId = note?.id ?? null;
    if (currentId === prevNoteIdRef.current) return;
    prevNoteIdRef.current = currentId;

    if (writingRef.current) {
      if (note?.text === lastWrittenRef.current) {
        writingRef.current = false;
      }
      return;
    }
    if (!dirtyRef.current) {
      setDraft(note?.text ?? "");
    }
    // note?.text is tracked so the effect runs when DB text changes, but the
    // prevNoteIdRef guard ensures the body only executes on note ID transitions.
  }, [note?.id, note?.text]);

  // selectNote / createNote are defined after autosave refs below
  // (they flush the dirty draft before switching notes).

  // ── Lazy note creation refs ──────────────────────────────────────
  // On first non-whitespace input, generate id client-side, INSERT with text.
  // Subsequent flushes UPDATE by pendingNoteId.
  const pendingNoteIdRef = useRef<string | null>(null);

  // ── Panel state ──────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();

  // ── Autosave ─────────────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  const flushAutosave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!dirtyRef.current) return;
    const text = getDraft();
    dirtyRef.current = false;

    const existingNote = noteRef.current;
    const pendingId = pendingNoteIdRef.current;

    if (existingNote) {
      writingRef.current = true;
      lastWrittenRef.current = text;
      const now = new Date().toISOString();
      void db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
        text,
        now,
        existingNote.id,
      ]);
    } else if (pendingId && userId) {
      writingRef.current = true;
      lastWrittenRef.current = text;
      const now = new Date().toISOString();
      void db.execute(
        "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        [pendingId, userId, text, "open", now, now],
      );
    }
  }, [db, userId, getDraft]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      flushAutosave();
    }, 500);
  }, [flushAutosave]);

  // Flush on unmount (page navigation)
  useEffect(() => {
    return () => {
      flushAutosave();
    };
  }, [flushAutosave]);

  // Flush on visibilitychange (hidden) and pagehide
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushAutosave();
    };
    const handlePageHide = () => flushAutosave();
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
  const closePanel = useCallback(() => {
    flushAutosave();
    setPanelOpen(false);
  }, [flushAutosave]);

  // ── Select / create notes ──────────────────────────────────────────
  // Both flush the dirty draft to the previously active note first so
  // switching never loses typed text.
  const selectNote = useCallback(
    async (id: string) => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      const prevId = noteRef.current?.id ?? null;
      if (dirtyRef.current && prevId) {
        const text = draftRef.current;
        dirtyRef.current = false;
        writingRef.current = true;
        lastWrittenRef.current = text;
        const now = new Date().toISOString();
        try {
          await db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
            text,
            now,
            prevId,
          ]);
        } finally {
          writingRef.current = false;
        }
      } else {
        dirtyRef.current = false;
      }
      setSelectedNoteId(id);
      const target = allNotes.find((n) => n.id === id);
      if (target) {
        setDraft(target.text);
      }
    },
    [allNotes, db],
  );

  const createNote = useCallback(async () => {
    if (!userId) return null;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const prevId = noteRef.current?.id ?? null;
    if (dirtyRef.current && prevId) {
      const text = draftRef.current;
      dirtyRef.current = false;
      const now = new Date().toISOString();
      await db.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
        text,
        now,
        prevId,
      ]);
    } else {
      dirtyRef.current = false;
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO quick_notes (id, user_id, text, status, created_at, updated_at) VALUES (?,?,?,?,?,?)",
      [id, userId, "", "open", now, now],
    );
    pendingNoteIdRef.current = null;
    writingRef.current = false;
    lastWrittenRef.current = null;
    setSelectedNoteId(id);
    setDraft("");
    return id;
  }, [db, userId]);

  // ── Text update (capture mode) ───────────────────────────────────
  const updateText = useCallback(
    (text: string) => {
      dirtyRef.current = true;
      draftRef.current = text;
      setDraft(text);
      // Lazily create note on first non-whitespace input
      if (text.trim().length > 0 && !noteRef.current && !pendingNoteIdRef.current && userId) {
        pendingNoteIdRef.current = uuidv4();
      }
      scheduleAutosave();
    },
    [scheduleAutosave, userId],
  );

  // ── Replace a single line's text (process mode) ──────────────────
  const updateLineText = useCallback(
    (index: number, newText: string) => {
      dirtyRef.current = true;
      const nextText = replaceLine(draftRef.current, index, newText);
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

      let resultText: string | null = null;
      let didArchive = false;
      let ideaIdToDelete: string | null = null;

      await db.writeTransaction(async (tx) => {
        // 1. Flush the draft into the note as the first statement
        if (dirtyRef.current) {
          const now = new Date().toISOString();
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
            draftRef.current,
            now,
            note.id,
          ]);
          dirtyRef.current = false;
        }

        // 2. Use the current draft directly (avoids stale read from DB)
        const currentText = draftRef.current;

        const lines = parseNoteLines(currentText);
        const target = lines.find((l) => l.index === index);

        // 3. Guard: line missing or already resolved.
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
          await tx.execute(
            "UPDATE quick_notes SET text = ?, status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?",
            [newText, now, now, note.id],
          );
        } else {
          await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
            newText,
            now,
            note.id,
          ]);
        }

        resultText = newText;
      });

      // 7. Only update draft if the transaction succeeded
      if (resultText !== null) {
        dirtyRef.current = false;
        draftRef.current = resultText;
        setDraft(resultText);

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
  const discardNote = useCallback(async () => {
    if (!note) return;
    const capturedNoteId = note.id;
    const now = new Date().toISOString();
    await db.execute("UPDATE quick_notes SET deleted_at = ?, updated_at = ? WHERE id = ?", [
      now,
      now,
      capturedNoteId,
    ]);
    registerUndo({
      label: "Note discarded",
      run: async () => {
        await db.execute(
          "UPDATE quick_notes SET deleted_at = NULL, status = 'open', updated_at = ? WHERE id = ?",
          [new Date().toISOString(), capturedNoteId],
        );
      },
    });
  }, [note, db, registerUndo]);

  // ── Derived values ───────────────────────────────────────────────
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
