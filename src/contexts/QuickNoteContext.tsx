"use client";

/* eslint-disable react-hooks/set-state-in-effect -- standard pattern for resetting state on prop change */

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

interface QuickNoteContextValue {
  note: QuickNote | null;
  loading: boolean;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
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
  /** Number of unresolved non-empty lines. */
  unreadCount: number;
  /** Undo bar state (owned by this context, not the page). */
  undoAction: ReturnType<typeof useUndoAction>["undoAction"];
  handleUndo: ReturnType<typeof useUndoAction>["handleUndo"];
  clearUndo: ReturnType<typeof useUndoAction>["clearUndo"];
  /** Current draft text (for Process mode to read). */
  draft: string;
  /** All quick notes (open + archived, excluding deleted). */
  allNotes: QuickNote[];
  /** The currently selected note in the panel (may be open or archived). */
  selectedNote: QuickNote | null;
  /** Select a note by id to view in the panel. */
  selectNote: (id: string) => void;
  /** Whether the currently selected note is the live open note (editable). */
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
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        b.id.localeCompare(a.id),
    );
  }, [rawRows]);

  // ── Heal: merge offline-duplicate open notes ─────────────────────
  // Runs whenever !isLoading && openNotes.length > 1.
  // In-flight ref guards against concurrent runs.
  const healingRef = useRef(false);
  useEffect(() => {
    if (isLoading || openNotes.length <= 1 || healingRef.current) return;
    healingRef.current = true;
    const [canonical, ...duplicates] = openNotes;
    // Append older notes' text ordered by created_at ASC
    const sortedDups = [...duplicates].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const mergedText = [
      canonical.text,
      ...sortedDups.map((d) => d.text).filter((t) => t.trim() !== ""),
    ].join("\n");
    const now = new Date().toISOString();
    void db
      .writeTransaction(async (tx) => {
        await tx.execute("UPDATE quick_notes SET text = ?, updated_at = ? WHERE id = ?", [
          mergedText,
          now,
          canonical.id,
        ]);
        for (const dup of sortedDups) {
          await tx.execute("UPDATE quick_notes SET deleted_at = ? WHERE id = ?", [now, dup.id]);
        }
      })
      .then(() => {
        healingRef.current = false;
      });
  }, [isLoading, openNotes, db]);

  const note = openNotes[0] ?? null;

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

  // Default selection to the open note
  useEffect(() => {
    if (note && !selectedNoteId) {
      setSelectedNoteId(note.id);
    }
  }, [note, selectedNoteId]);

  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return note;
    return allNotes.find((n) => n.id === selectedNoteId) ?? note;
  }, [selectedNoteId, allNotes, note]);

  const isSelectedNoteLive = selectedNote?.id === note?.id;

  const selectNote = useCallback((id: string) => {
    setSelectedNoteId(id);
  }, []);

  // ── Local draft state ────────────────────────────────────────────
  const [draft, setDraft] = useState("");
  const dirtyRef = useRef(false);
  const writingRef = useRef(false);
  const lastWrittenRef = useRef<string | null>(null);

  // Getter for the latest draft value (avoids stale closures in flushAutosave)
  const getDraft = useCallback(() => draft, [draft]);

  // Sync draft from DB only when not dirty AND not waiting for a write to land.
  // Without the writingRef guard, PowerSync can re-emit the query with stale text
  // before the write completes, overwriting the user's edits.
  // When the DB text matches what we last wrote, the write has landed — clear writingRef.
  useEffect(() => {
    if (writingRef.current) {
      if (note?.text === lastWrittenRef.current) {
        writingRef.current = false;
      }
      return;
    }
    if (!dirtyRef.current) {
      setDraft(note?.text ?? "");
    }
  }, [note?.text, note?.id]);

  // Sync draft when switching to a different (archived) note via selectNote.
  useEffect(() => {
    if (selectedNote && selectedNote.id !== note?.id) {
      // Viewing an archived note — show its text, not the live draft
      setDraft(selectedNote.text);
      dirtyRef.current = false;
    } else if (selectedNote?.id === note?.id && !dirtyRef.current) {
      // Switched back to the live note — sync from DB
      setDraft(note?.text ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to selection changes
  }, [selectedNote?.id]);

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
  const draftRef = useRef(draft);
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
  const openPanel = useCallback(() => {
    setSelectedNoteId(null); // reset to default (live note)
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => {
    flushAutosave();
    setPanelOpen(false);
  }, [flushAutosave]);

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

        // 2. Re-read the latest text inside the transaction
        const rows = await tx.getAll<{ text: string }>(
          "SELECT text FROM quick_notes WHERE id = ?",
          [note.id],
        );
        if (rows.length === 0) return;
        const currentText = rows[0].text;

        const lines = parseNoteLines(currentText);
        const target = lines.find((l) => l.index === index);

        // 3. Guard: line missing, already resolved, or content mismatch
        if (!target || target.resolved) return;
        if (target.text !== action.expectedText) return;

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

  // ── Context value ────────────────────────────────────────────────
  const value: QuickNoteContextValue = useMemo(
    () => ({
      note,
      loading: isLoading,
      panelOpen,
      openPanel,
      closePanel,
      flushNow: flushAutosave,
      updateText,
      updateLineText,
      resolveLine,
      discardNote,
      unreadCount,
      undoAction,
      handleUndo,
      clearUndo,
      draft,
      allNotes,
      selectedNote,
      selectNote,
      isSelectedNoteLive,
    }),
    [
      note,
      isLoading,
      panelOpen,
      openPanel,
      closePanel,
      flushAutosave,
      updateText,
      updateLineText,
      resolveLine,
      discardNote,
      unreadCount,
      undoAction,
      handleUndo,
      clearUndo,
      draft,
      allNotes,
      selectedNote,
      selectNote,
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
