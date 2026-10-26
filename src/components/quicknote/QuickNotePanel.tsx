"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { LAYER_MODAL } from "@/lib/layers";
import {
  X,
  FileText,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  AlertCircle,
} from "lucide-react";
import { memo } from "react";
import {
  useQuickNoteSaveState,
  useQuickNoteData,
  type QuickNotePanelMode,
} from "@/contexts/QuickNoteContext";
import { useCalmedSaveStatus } from "@/lib/quicknote/useCalmedSaveStatus";
import { QuickNoteCapture } from "./QuickNoteCapture";
import { QuickNoteList } from "./QuickNoteList";
import { useNotes } from "@/contexts/NotesContext";
import type { QuickNoteOperationFailureReason } from "@/lib/quicknote/operations";

const MODE_STORAGE_KEY = "quicknote-panel-mode";
// "process" was removed (selection-based flow); stale stored values fall
// back to "capture" via the VALID_MODES check in readStoredMode.
const VALID_MODES: QuickNotePanelMode[] = ["capture", "list"];

function readStoredMode(): QuickNotePanelMode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored as QuickNotePanelMode))
      return stored as QuickNotePanelMode;
  } catch {}
  return "capture";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function operationErrorMessage(reason: QuickNoteOperationFailureReason): string {
  switch (reason) {
    case "save_failed":
      return "Couldn't switch notes because the current note hasn't saved. Your draft is still here; try again when saving succeeds.";
    case "not_found":
      return "That note is no longer available. Refresh the list and try again.";
    case "unauthenticated":
      return "Sign in to create a quick note.";
    case "create_failed":
      return "Couldn't create a quick note. Check your connection and try again.";
  }
}

/**
 * Header unsaved dot. Isolated in its own component subscribed to the
 * per-keystroke draft context so panel chrome doesn't re-render on typing.
 */
const CaptureStatusDot = memo(function CaptureStatusDot() {
  const { saveStatus } = useQuickNoteSaveState();
  const calmedSaveStatus = useCalmedSaveStatus(saveStatus);
  if (calmedSaveStatus !== "editing" && calmedSaveStatus !== "error") return null;
  const isError = calmedSaveStatus === "error";
  const label = isError ? "Save failed — will retry" : "Unsaved changes";
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isError ? "bg-red-500" : "bg-amber-400"}`}
      title={label}
      aria-label={label}
    />
  );
});

export function QuickNotePanel() {
  const {
    openNotes,
    note,
    selectedNote,
    selectNote,
    createNote,
    panelOpen,
    closePanel,
    discardNote,
    isSelectedNoteLive,
    requestedMode,
    consumeRequestedMode,
  } = useQuickNoteData();
  const { detailsOpen } = useNotes();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<QuickNotePanelMode>(readStoredMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editState, setEditState] = useState({ panelOpen, noteId: null as string | null });
  // Two-step discard confirm: first click arms, second click executes.
  const [discardArmed, setDiscardArmed] = useState(false);

  if (editState.panelOpen !== panelOpen) {
    setEditState({ panelOpen, noteId: null });
  }

  const persistMode = useCallback(
    (next: QuickNotePanelMode) => {
      setMode(next);
      setMenuOpen(false);
      setDiscardArmed(false);
      consumeRequestedMode();
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {}
    },
    [consumeRequestedMode],
  );

  // openPanel(mode) requests (e.g. chip opening the list) take precedence
  // until the user navigates — derived during render, no effect needed.
  const effectiveMode = panelOpen && requestedMode ? requestedMode : mode;

  useEffect(() => {
    if (!panelOpen) return;
    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    panelRef.current?.focus();
    return () => {
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
      restoreFocusRef.current = null;
    };
  }, [panelOpen]);

  // Escape to close (closePanel awaits the pending autosave first)
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab" && !detailsOpen) {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if (e.key === "Escape") {
        // The details drawer is the top overlay; let its Escape handler close
        // it first while preserving the Quick Note underneath.
        if (detailsOpen) return;
        e.preventDefault();
        setMenuOpen(false);
        setDiscardArmed(false);
        void closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, closePanel, detailsOpen]);

  const handleDiscard = useCallback(async () => {
    if (!discardArmed) {
      // Arm: require an explicit second click to confirm.
      setDiscardArmed(true);
      return;
    }
    if (discarding) return;
    setDiscarding(true);
    try {
      setMenuOpen(false);
      setDiscardArmed(false);
      // Discard targets the live/editing note. Resolve the survivor from the
      // pre-delete list: the note sliding into the discarded row's position
      // (next-older), falling back to the newer neighbor at the list end.
      const discardedId = note?.id ?? null;
      const idx = discardedId ? openNotes.findIndex((n) => n.id === discardedId) : -1;
      const next =
        idx >= 0
          ? (openNotes[idx + 1] ?? openNotes[idx - 1] ?? null)
          : (openNotes.find((n) => n.id !== discardedId) ?? null);
      await discardNote();
      // Keep the panel open on the next note; close only when none remain.
      if (!next) {
        await closePanel();
      } else {
        const result = await selectNote(next.id);
        if (!result.ok) setActionError(operationErrorMessage(result.reason));
      }
    } finally {
      setDiscarding(false);
    }
  }, [discardArmed, discarding, note, openNotes, selectNote, discardNote, closePanel]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setDiscardArmed(false);
  }, []);

  const handleNew = useCallback(() => {
    if (creating) return;
    setCreating(true);
    void createNote()
      .then((result) => {
        if (!result.ok) {
          setActionError(operationErrorMessage(result.reason));
          return;
        }
        setActionError(null);
        setEditState((prev) => ({ ...prev, noteId: result.id }));
        persistMode("capture");
      })
      .finally(() => setCreating(false));
  }, [creating, createNote, persistMode]);

  const handleListNavigate = useCallback(
    (next: QuickNotePanelMode, createdNoteId?: string) => {
      setActionError(null);
      setEditState((prev) => ({ ...prev, noteId: createdNoteId ?? null }));
      persistMode(next);
    },
    [persistMode],
  );

  const handleActionError = useCallback((reason: QuickNoteOperationFailureReason) => {
    setActionError(operationErrorMessage(reason));
  }, []);

  const selectedIndex = selectedNote ? openNotes.findIndex((n) => n.id === selectedNote.id) : -1;
  // Displayed numbers are chronological (oldest = 1, newest = N) while
  // openNotes is sorted newest-first, so "previous" (‹, lower number) moves
  // toward the END of the array and "next" (›, higher number) toward index 0.
  const canOlder = selectedIndex >= 0 && selectedIndex < openNotes.length - 1;
  const canNewer = selectedIndex > 0;

  const stepNote = useCallback(
    (dir: -1 | 1) => {
      // dir -1 = previous/older (‹), dir +1 = next/newer (›).
      const next = openNotes[selectedIndex - dir];
      if (next) {
        void selectNote(next.id).then((result) => {
          setActionError(result.ok ? null : operationErrorMessage(result.reason));
        });
      }
    },
    [openNotes, selectedIndex, selectNote],
  );

  if (!panelOpen) return null;

  const positionLabel =
    selectedIndex >= 0 ? `Note ${openNotes.length - selectedIndex} of ${openNotes.length}` : null;
  const timestampLabel = selectedNote ? formatTimestamp(selectedNote.created_at) : null;

  return createPortal(
    <div
      style={{ zIndex: LAYER_MODAL }}
      className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-gray-950/35 backdrop-blur-[3px]"
        onClick={closePanel}
        aria-label="Close quick notes"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-note-dialog-title"
        tabIndex={-1}
        className="relative flex w-full flex-col overflow-hidden rounded-t-3xl border border-black/5 bg-white shadow-2xl focus:outline-none sm:max-w-3xl sm:rounded-3xl dark:border-white/10 dark:bg-gray-900"
        style={{ maxHeight: "min(88dvh, 720px)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-gray-50/70 px-4 py-3.5 sm:px-6 dark:border-white/5 dark:bg-gray-950/30">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <FileText size={17} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              {effectiveMode === "list" ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => persistMode("capture")}
                    className="flex cursor-pointer items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-violet-300 dark:hover:bg-violet-500/10"
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>
                  <h2
                    id="quick-note-dialog-title"
                    className="text-sm font-bold tracking-tight text-gray-800 dark:text-gray-100"
                  >
                    All notes
                  </h2>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2
                    id="quick-note-dialog-title"
                    className="truncate text-sm font-bold tracking-tight text-gray-800 dark:text-gray-100"
                  >
                    {isSelectedNoteLive ? "Quick Note" : "Archived Note"}
                  </h2>
                  {isSelectedNoteLive && <CaptureStatusDot />}
                  {effectiveMode === "capture" && openNotes.length > 1 && selectedIndex >= 0 && (
                    <span className="flex shrink-0 items-center">
                      <button
                        onClick={() => stepNote(-1)}
                        disabled={!canOlder}
                        aria-label="Previous note"
                        title="Previous (older) note"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5 dark:hover:text-gray-200"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        onClick={() => stepNote(1)}
                        disabled={!canNewer}
                        aria-label="Next note"
                        title="Next (newer) note"
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5 dark:hover:text-gray-200"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </span>
                  )}
                </div>
              )}
              {positionLabel && timestampLabel && (
                <span
                  className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400"
                  title={new Date(selectedNote!.created_at).toLocaleString()}
                >
                  {positionLabel} · {timestampLabel}
                </span>
              )}
              {effectiveMode === "list" && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {openNotes.length} open {openNotes.length === 1 ? "note" : "notes"}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {effectiveMode !== "list" && (
              <button
                onClick={() => persistMode("list")}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
                title="Browse all notes"
                aria-label="Browse all notes"
              >
                <List size={16} />
                <span className="hidden sm:inline">Notes</span>
              </button>
            )}

            <button
              onClick={handleNew}
              disabled={creating}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              title="New note"
              aria-label="New note"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">{creating ? "Creating…" : "New"}</span>
            </button>

            {effectiveMode === "capture" && isSelectedNoteLive && (
              <div className="relative">
                <button
                  onClick={() => {
                    setMenuOpen(!menuOpen);
                    setDiscardArmed(false);
                  }}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
                  aria-label="More options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={closeMenu} />
                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
                      <button
                        onClick={handleDiscard}
                        disabled={discarding}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                          discardArmed
                            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                            : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                        }`}
                      >
                        <Trash2 size={13} />
                        {discarding
                          ? "Discarding…"
                          : discardArmed
                            ? "Click again to confirm discard"
                            : "Discard note"}
                      </button>
                      {discardArmed && !discarding && (
                        <p className="px-3 pt-0 pb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                          Unsaved text in this note will be lost. You can undo right after.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => void closePanel()}
              aria-label="Close quick note"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {actionError && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 sm:mx-6 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Dismiss error"
                className="shrink-0 rounded p-0.5 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-500 dark:hover:bg-red-900/40"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {effectiveMode === "list" ? (
            <QuickNoteList onNavigate={handleListNavigate} onError={handleActionError} />
          ) : (
            <QuickNoteCapture
              editing={selectedNote?.id === editState.noteId}
              onEditingChange={(next) =>
                setEditState((prev) => ({
                  ...prev,
                  noteId: next ? (selectedNote?.id ?? null) : null,
                }))
              }
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
