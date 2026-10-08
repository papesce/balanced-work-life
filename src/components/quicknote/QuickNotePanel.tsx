"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [mode, setMode] = useState<QuickNotePanelMode>(readStoredMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  // Two-step discard confirm: first click arms, second click executes.
  const [discardArmed, setDiscardArmed] = useState(false);

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

  // Escape to close (closePanel awaits the pending autosave first)
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        setDiscardArmed(false);
        void closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, closePanel]);

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
      await discardNote();
      await closePanel();
    } finally {
      setDiscarding(false);
    }
  }, [discardArmed, discarding, discardNote, closePanel]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setDiscardArmed(false);
  }, []);

  const handleNew = useCallback(() => {
    if (creating) return;
    setCreating(true);
    void createNote()
      .then(() => persistMode("capture"))
      .finally(() => setCreating(false));
  }, [creating, createNote, persistMode]);

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
      if (next) void selectNote(next.id);
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
      className="fixed inset-0 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={closePanel}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="relative flex w-full flex-col rounded-t-2xl bg-white shadow-xl sm:mx-4 sm:max-w-lg sm:rounded-2xl dark:bg-gray-900"
        style={{ maxHeight: "min(80vh, 600px)" }}
      >
        {/* Header: title stacks over meta so neither truncates the other;
            actions are labeled (not icon-only) except close. */}
        <div className="flex items-start justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {effectiveMode !== "capture" ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => persistMode("capture")}
                  className="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                >
                  <ChevronLeft size={14} />
                  <span>Back</span>
                </button>
                <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                  All notes
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <FileText size={16} className="shrink-0 text-violet-500" />
                <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isSelectedNoteLive ? "Quick Note" : "Archived Note"}
                </span>
                {isSelectedNoteLive && <CaptureStatusDot />}
                {effectiveMode === "capture" && openNotes.length > 1 && selectedIndex >= 0 && (
                  <span className="flex shrink-0 items-center">
                    <button
                      onClick={() => stepNote(-1)}
                      disabled={!canOlder}
                      aria-label="Previous note"
                      title="Previous (older) note"
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      onClick={() => stepNote(1)}
                      disabled={!canNewer}
                      aria-label="Next note"
                      title="Next (newer) note"
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </span>
                )}
              </div>
            )}
            {positionLabel && timestampLabel && (
              <span
                className="truncate text-xs font-normal text-gray-500 dark:text-gray-400"
                title={new Date(selectedNote!.created_at).toLocaleString()}
              >
                {positionLabel} · {timestampLabel}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {effectiveMode !== "list" && (
              <button
                onClick={() => persistMode("list")}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
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
              className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
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
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
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
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {effectiveMode === "list" ? (
            <QuickNoteList onNavigate={persistMode} />
          ) : (
            <QuickNoteCapture />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
