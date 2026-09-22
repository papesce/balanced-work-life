"use client";

/**
 * QuickNoteContext — thin composition over focused modules.
 *
 * State and logic live in `src/lib/quicknote/`:
 * - `notes.ts` — row queries + selection model (single source of rows)
 * - `draft.ts` — draft state machine (single-writer, truthful dirty, provenance)
 * - `persistence.ts` — THE single write path + autosave + edit entry points
 * - `operations.ts` — select/create/resolve/discard orchestration
 * - `log.ts` — all logging behind the `quicknote-debug` flag
 * - `types.ts` — shared types
 *
 * This file only wires them together: panel open/close, the global keyboard
 * shortcut, derived counts, the context value, and the UndoBar/Panel render.
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
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePowerSync } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { QuickNote } from "@/lib/types";
import { unresolvedNonEmptyCount } from "@/lib/quickNotes";
import { useUndoAction } from "@/lib/tasks/undo";
import { UndoBar } from "@/components/shared/UndoBar";
import { QuickNotePanel } from "@/components/quicknote/QuickNotePanel";
import { useQuickNoteDraft } from "@/lib/quicknote/draft";
import { useQuickNoteNotes } from "@/lib/quicknote/notes";
import { useQuickNotePersistence } from "@/lib/quicknote/persistence";
import { useQuickNoteOperations } from "@/lib/quicknote/operations";
import type {
  QuickNotePanelMode,
  QuickNoteSaveStatus,
  QuickNoteFlushOrigin,
  ResolveAction,
} from "@/lib/quicknote/types";
import { qnDebug, qnInfo } from "@/lib/quicknote/log";

export type { QuickNotePanelMode, QuickNoteSaveStatus } from "@/lib/quicknote/types";

interface QuickNoteContextValue {
  note: QuickNote | null;
  loading: boolean;
  panelOpen: boolean;
  openPanel: (mode?: QuickNotePanelMode) => void;
  closePanel: () => Promise<void>;
  /** Requested panel mode (consumed by the panel on open). Null = no request. */
  requestedMode: QuickNotePanelMode | null;
  consumeRequestedMode: () => void;
  /** Flush pending autosave immediately. Resolves after the write lands (or fails). */
  flushNow: (origin?: QuickNoteFlushOrigin) => Promise<void>;
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
  /** Number of open notes with at least one unresolved non-empty line. */
  pendingNotesCount: number;
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

export function useQuickNoteContext() {
  const ctx = useContext(QuickNoteContext);
  if (!ctx) throw new Error("useQuickNoteContext must be used within QuickNoteProvider");
  return ctx;
}

export function QuickNoteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  const notes = useQuickNoteNotes(userId);
  const draft = useQuickNoteDraft();
  const persistence = useQuickNotePersistence({
    db,
    userId,
    draft,
    activeNoteRef: notes.noteRef,
  });
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const ops = useQuickNoteOperations({
    db,
    userId,
    notes,
    draft,
    persistence,
    registerUndo,
  });

  // Sync draft from DB on note switches (initial load, selection change).
  // Skipped while dirty (user edits win) or while a write is landing.
  // State updates here are intentional and guarded to run once per note id.
  const prevNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = notes.note?.id ?? null;
    if (currentId === prevNoteIdRef.current) return;
    qnDebug("draft-sync: note switch", {
      prevId: prevNoteIdRef.current,
      currentId,
      dbTextLength: notes.note?.text?.length ?? 0,
      dirty: draft.dirtyRef.current,
      writing: draft.writingRef.current,
    });
    prevNoteIdRef.current = currentId;

    if (draft.writingRef.current) {
      if (notes.note?.text === draft.lastWrittenRef.current) {
        draft.clearWriting();
      }
      return;
    }
    if (!draft.dirtyRef.current) {
      const dbText = notes.note?.text ?? "";
      qnInfo(
        `draft-sync: loading draft len=${dbText.length} for note ${currentId ?? "(none)"} from DB row`,
      );
      draft.load(currentId, dbText);
    } else {
      qnInfo(
        `draft-sync: note switch to ${currentId ?? "(none)"} skipped — draft is dirty (len=${draft.draftRef.current.length}, base len=${draft.baseTextRef.current.length})`,
      );
    }
    // note text is tracked so the effect runs when DB text changes, but the
    // prevNoteId guard ensures the body only executes on note ID transitions.
  }, [notes.note?.id, notes.note?.text, notes.note, draft]);

  // ── Panel open/close ─────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [requestedMode, setRequestedMode] = useState<QuickNotePanelMode | null>(null);
  const openPanel = useCallback((mode?: QuickNotePanelMode) => {
    if (mode) setRequestedMode(mode);
    else setRequestedMode(null);
    setPanelOpen(true);
  }, []);
  const consumeRequestedMode = useCallback(() => setRequestedMode(null), []);
  const closePanel = useCallback(async () => {
    // Await the flush so the last ~500ms of typing isn't lost behind the
    // unmount. On failure dirty stays truthful and the draft survives in
    // provider state, so reopening shows the unsaved text.
    await persistence.flushAutosave("close");
    setPanelOpen(false);
  }, [persistence]);

  // ── Keyboard shortcut: Cmd/Ctrl + Alt + N ───────────────────────
  // Cmd+Shift+N is taken by Chrome/Safari (incognito window).
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

  // ── Derived values ───────────────────────────────────────────────
  const unreadCount = useMemo(
    () => (notes.note ? unresolvedNonEmptyCount(draft.draft || notes.note.text) : 0),
    [notes.note, draft.draft],
  );
  const totalUnreadCount = useMemo(
    () =>
      notes.openNotes.reduce(
        (sum, n) =>
          sum + unresolvedNonEmptyCount(n.id === notes.note?.id ? draft.draft || n.text : n.text),
        0,
      ),
    [notes.openNotes, notes.note?.id, draft.draft],
  );
  const pendingNotesCount = useMemo(
    () =>
      notes.openNotes.reduce((count, n) => {
        const text = n.id === notes.note?.id ? draft.draft || n.text : n.text;
        return count + (unresolvedNonEmptyCount(text) > 0 ? 1 : 0);
      }, 0),
    [notes.openNotes, notes.note?.id, draft.draft],
  );

  // ── Context value ────────────────────────────────────────────────
  const value: QuickNoteContextValue = useMemo(
    () => ({
      note: notes.note,
      loading: notes.loading,
      panelOpen,
      openPanel,
      closePanel,
      requestedMode,
      consumeRequestedMode,
      flushNow: persistence.flushAutosave,
      hasUnsaved: persistence.hasUnsaved,
      updateText: persistence.updateText,
      updateLineText: persistence.updateLineText,
      resolveLine: ops.resolveLine,
      discardNote: ops.discardNote,
      unreadCount,
      totalUnreadCount,
      pendingNotesCount,
      undoAction,
      handleUndo,
      clearUndo,
      draft: draft.draft,
      allNotes: notes.allNotes,
      openNotes: notes.openNotes,
      selectedNote: notes.selectedNote,
      selectNote: ops.selectNote,
      createNote: ops.createNote,
      isSelectedNoteLive: notes.isSelectedNoteLive,
      saveStatus: persistence.saveStatus,
      lastSavedAt: persistence.lastSavedAt,
    }),
    [
      notes,
      draft.draft,
      persistence,
      ops,
      panelOpen,
      openPanel,
      closePanel,
      requestedMode,
      consumeRequestedMode,
      unreadCount,
      totalUnreadCount,
      pendingNotesCount,
      undoAction,
      handleUndo,
      clearUndo,
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
