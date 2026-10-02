"use client";

/**
 * QuickNoteContext — thin composition over focused modules.
 *
 * Performance split: draft text changes on every keystroke, while note lists /
 * counts / panel state change rarely. Separate contexts keep per-keystroke
 * renders scoped to the textarea instead of the whole app shell:
 * - editor context — high frequency: draft and updateText
 * - save context — low frequency: save status and timestamp
 * - `QuickNoteDataContext` — low frequency: notes, counts, panel, ops
 *
 * Components subscribe to the narrowest slice they need: use
 * `useQuickNoteDraftState()` in the textarea path, `useQuickNoteData()`
 * everywhere else.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useDeferredValue,
  type ReactNode,
} from "react";
import { usePowerSync } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { QuickNote } from "@/lib/types";
import { unresolvedNonEmptyCount } from "@/lib/quickNotes";
import { useUndoAction } from "@/lib/tasks/undo";
import { QuickNotePanel } from "@/components/quicknote/QuickNotePanel";
import { useQuickNoteDraft } from "@/lib/quicknote/draft";
import { useQuickNoteNotes } from "@/lib/quicknote/notes";
import { useQuickNotePersistence } from "@/lib/quicknote/persistence";
import { useQuickNoteOperations } from "@/lib/quicknote/operations";
import type { QuickNotePanelMode, QuickNoteSaveStatus } from "@/lib/quicknote/types";

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
  flushNow: () => Promise<void>;
  /** True while there are edits not yet confirmed persisted (drives close guards). */
  hasUnsaved: boolean;
  /** Update the full note text (capture mode). Creates the note lazily on first non-whitespace input. */
  updateText: (text: string) => void;
  /** Create an idea from selected text. Never mutates note text. */
  createSelectionIdea: (text: string, parentId?: string | null) => Promise<string | null>;
  /** Soft-delete the entire note. */
  discardNote: () => Promise<void>;
  /** Reopen the selected archived note. No-op unless it is archived. */
  reopenNote: () => Promise<void>;
  /** Number of unresolved non-empty lines in the active note. */
  unreadCount: number;
  /** Total unresolved lines across all open notes. */
  totalUnreadCount: number;
  /** Number of open notes with at least one unresolved non-empty line. */
  pendingNotesCount: number;
  /** Undo bar state (global singleton — rendered by the active page's bar). */
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

/** Per-keystroke slice: changes only when the draft text changes. */
interface QuickNoteEditorContextValue {
  draft: string;
  updateText: (text: string) => void;
  flushNow: () => Promise<void>;
}

/** Per-flush slice: changes when an autosave cycle runs. */
interface QuickNoteSaveContextValue {
  saveStatus: QuickNoteSaveStatus;
  lastSavedAt: string | null;
  hasUnsaved: boolean;
}

/** Note identity/status used by capture UI without subscribing to note text updates. */
interface QuickNoteCaptureMetaContextValue {
  noteId: string | null;
  noteUpdatedAt: string | null;
  isSelectedNoteLive: boolean;
  reopenNote: () => Promise<void>;
}

/** Low-frequency slice: stable across keystrokes. */
type QuickNoteDataContextValue = Omit<
  QuickNoteContextValue,
  "draft" | "updateText" | "saveStatus" | "lastSavedAt" | "hasUnsaved" | "flushNow"
>;

const QuickNoteEditorContext = createContext<QuickNoteEditorContextValue | null>(null);
const QuickNoteSaveContext = createContext<QuickNoteSaveContextValue | null>(null);
const QuickNoteDataContext = createContext<QuickNoteDataContextValue | null>(null);
const QuickNoteCaptureMetaContext = createContext<QuickNoteCaptureMetaContextValue | null>(null);

/**
 * Subscribes only to per-keystroke state (the textarea). This value changes
 * exactly once per keystroke — never on flush cycles — so the editor renders
 * 1:1 with typing.
 */
export function useQuickNoteEditor() {
  const ctx = useContext(QuickNoteEditorContext);
  if (!ctx) throw new Error("useQuickNoteEditor must be used within QuickNoteProvider");
  return ctx;
}

/** Subscribes only to autosave feedback (indicator, header dot). */
export function useQuickNoteSaveState() {
  const ctx = useContext(QuickNoteSaveContext);
  if (!ctx) throw new Error("useQuickNoteSaveState must be used within QuickNoteProvider");
  return ctx;
}

export function useQuickNoteCaptureMeta() {
  const ctx = useContext(QuickNoteCaptureMetaContext);
  if (!ctx) throw new Error("useQuickNoteCaptureMeta must be used within QuickNoteProvider");
  return ctx;
}

/** Back-compat alias: prefer useQuickNoteEditor() + useQuickNoteSaveState(). */
export function useQuickNoteDraftState() {
  const editor = useContext(QuickNoteEditorContext);
  const save = useContext(QuickNoteSaveContext);
  if (!editor || !save)
    throw new Error("useQuickNoteDraftState must be used within QuickNoteProvider");
  return { ...editor, ...save };
}

/** Subscribes only to low-frequency state (shell, chip, list, panel chrome). */
export function useQuickNoteData() {
  const ctx = useContext(QuickNoteDataContext);
  if (!ctx) throw new Error("useQuickNoteData must be used within QuickNoteProvider");
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
    prevNoteIdRef.current = currentId;

    if (draft.writingRef.current) {
      if (notes.note?.text === draft.lastWrittenRef.current) {
        draft.clearWriting();
      }
      return;
    }
    if (!draft.dirtyRef.current) {
      const dbText = notes.note?.text ?? "";
      draft.load(currentId, dbText);
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
  const { flushAutosave, updateText } = persistence;
  const closePanel = useCallback(async () => {
    // Await the flush so the last ~500ms of typing isn't lost behind the
    // unmount. On failure dirty stays truthful and the draft survives in
    // provider state, so reopening shows the unsaved text.
    await flushAutosave();
    setPanelOpen(false);
  }, [flushAutosave]);

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
  // Every count reads the DEFERRED draft, not the live one. The live draft
  // changes per keystroke and these are the only draft-dependent values in
  // the data slice, so deferring them is what keeps `dataValue` (and thus
  // AppShell / chip / list / panel chrome) referentially stable while typing.
  // Badges land a frame or two later — imperceptible for a count.
  const deferredDraft = useDeferredValue(draft.draft);
  const activeText = notes.note ? deferredDraft || notes.note.text : "";
  const unreadCount = useMemo(
    () => (notes.note ? unresolvedNonEmptyCount(activeText) : 0),
    [notes.note, activeText],
  );
  const totalUnreadCount = useMemo(
    () =>
      notes.openNotes.reduce(
        (sum, n) =>
          sum + unresolvedNonEmptyCount(n.id === notes.note?.id ? deferredDraft || n.text : n.text),
        0,
      ),
    [notes.openNotes, notes.note?.id, deferredDraft],
  );
  const pendingNotesCount = useMemo(
    () =>
      notes.openNotes.reduce((count, n) => {
        const text = n.id === notes.note?.id ? deferredDraft || n.text : n.text;
        return count + (unresolvedNonEmptyCount(text) > 0 ? 1 : 0);
      }, 0),
    [notes.openNotes, notes.note?.id, deferredDraft],
  );

  // ── Split context values ─────────────────────────────────────────
  // editorValue changes exactly once per keystroke (draft text only), so the
  // textarea renders 1:1 with typing. saveValue changes as saving progresses
  // and drives only the indicator + header dot.
  // dataValue stays referentially stable across both, so AppShell / chip /
  // list / panel chrome don't re-render while typing.
  const { saveStatus, lastSavedAt, hasUnsaved } = persistence;
  const editorValue: QuickNoteEditorContextValue = useMemo(
    () => ({ draft: draft.draft, updateText, flushNow: flushAutosave }),
    [draft.draft, updateText, flushAutosave],
  );
  const saveValue: QuickNoteSaveContextValue = useMemo(
    () => ({ saveStatus, lastSavedAt, hasUnsaved }),
    [saveStatus, lastSavedAt, hasUnsaved],
  );
  const captureMetaValue: QuickNoteCaptureMetaContextValue = useMemo(
    () => ({
      noteId: notes.note?.id ?? null,
      noteUpdatedAt: notes.note?.updated_at ?? null,
      isSelectedNoteLive: notes.isSelectedNoteLive,
      reopenNote: ops.reopenNote,
    }),
    [notes.note?.id, notes.note?.updated_at, notes.isSelectedNoteLive, ops.reopenNote],
  );

  const dataValue: QuickNoteDataContextValue = useMemo(
    () => ({
      note: notes.note,
      loading: notes.loading,
      panelOpen,
      openPanel,
      closePanel,
      requestedMode,
      consumeRequestedMode,
      createSelectionIdea: ops.createSelectionIdea,
      discardNote: ops.discardNote,
      reopenNote: ops.reopenNote,
      unreadCount,
      totalUnreadCount,
      pendingNotesCount,
      undoAction,
      handleUndo,
      clearUndo,
      allNotes: notes.allNotes,
      openNotes: notes.openNotes,
      selectedNote: notes.selectedNote,
      selectNote: ops.selectNote,
      createNote: ops.createNote,
      isSelectedNoteLive: notes.isSelectedNoteLive,
    }),
    [
      notes.note,
      notes.loading,
      notes.allNotes,
      notes.openNotes,
      notes.selectedNote,
      notes.isSelectedNoteLive,
      ops.createSelectionIdea,
      ops.discardNote,
      ops.reopenNote,
      ops.selectNote,
      ops.createNote,
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

  // Kept referentially stable so the provider's per-keystroke re-render does
  // not force the panel chrome to re-render with it.
  // Note: no UndoBar here — undo state is a global singleton (feedbackStore)
  // rendered once by the active page's bar, avoiding duplicate toasts.
  const panelNode = useMemo(() => (user ? <QuickNotePanel /> : null), [user]);

  return (
    <QuickNoteEditorContext.Provider value={editorValue}>
      <QuickNoteSaveContext.Provider value={saveValue}>
        <QuickNoteCaptureMetaContext.Provider value={captureMetaValue}>
          <QuickNoteDataContext.Provider value={dataValue}>
            {children}
            {panelNode}
          </QuickNoteDataContext.Provider>
        </QuickNoteCaptureMetaContext.Provider>
      </QuickNoteSaveContext.Provider>
    </QuickNoteEditorContext.Provider>
  );
}
