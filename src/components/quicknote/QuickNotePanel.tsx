"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  MoreHorizontal,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from "lucide-react";
import { useQuickNoteContext, type QuickNotePanelMode } from "@/contexts/QuickNoteContext";
import { QuickNoteCapture } from "./QuickNoteCapture";
import { QuickNoteProcess } from "./QuickNoteProcess";
import { QuickNoteList } from "./QuickNoteList";

const MODE_STORAGE_KEY = "quicknote-panel-mode";
const VALID_MODES: QuickNotePanelMode[] = ["capture", "process", "list"];

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

export function QuickNotePanel() {
  const {
    note,
    openNotes,
    selectedNote,
    selectNote,
    createNote,
    panelOpen,
    closePanel,
    discardNote,
    unreadCount,
    isSelectedNoteLive,
    requestedMode,
    consumeRequestedMode,
  } = useQuickNoteContext();
  const [mode, setMode] = useState<QuickNotePanelMode>(readStoredMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const persistMode = useCallback(
    (next: QuickNotePanelMode) => {
      setMode(next);
      setMenuOpen(false);
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

  // Escape to close
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, closePanel]);

  const handleDiscard = useCallback(async () => {
    setMenuOpen(false);
    await discardNote();
    closePanel();
  }, [discardNote, closePanel]);

  const handleNew = useCallback(() => {
    if (creating) return;
    setCreating(true);
    void createNote()
      .then(() => persistMode("capture"))
      .finally(() => setCreating(false));
  }, [creating, createNote, persistMode]);

  const selectedIndex = selectedNote ? openNotes.findIndex((n) => n.id === selectedNote.id) : -1;
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < openNotes.length - 1;

  const stepNote = useCallback(
    (dir: -1 | 1) => {
      const next = openNotes[selectedIndex + dir];
      if (next) void selectNote(next.id);
    },
    [openNotes, selectedIndex, selectNote],
  );

  if (!panelOpen) return null;

  const canProcess = note && unreadCount > 0 && isSelectedNoteLive;
  const positionLabel =
    selectedIndex >= 0 ? `Note ${openNotes.length - selectedIndex} of ${openNotes.length}` : null;
  const timestampLabel = selectedNote ? formatTimestamp(selectedNote.created_at) : null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center">
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
          <div className="flex min-w-0 items-center gap-1">
            {effectiveMode !== "capture" ? (
              <button
                onClick={() => persistMode("capture")}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <>
                <FileText size={16} className="shrink-0 text-violet-500" />
                <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isSelectedNoteLive ? "Quick Note" : "Archived Note"}
                </span>
                {positionLabel && timestampLabel && (
                  <span
                    className="truncate text-[11px] font-normal text-gray-400 dark:text-gray-500"
                    title={new Date(selectedNote!.created_at).toLocaleString()}
                  >
                    · {positionLabel} · {timestampLabel}
                  </span>
                )}
              </>
            )}
            {effectiveMode === "capture" && openNotes.length > 1 && selectedIndex >= 0 && (
              <span className="flex shrink-0 items-center">
                <button
                  onClick={() => stepNote(-1)}
                  disabled={!canPrev}
                  aria-label="Previous note"
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => stepNote(1)}
                  disabled={!canNext}
                  aria-label="Next note"
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/5"
                >
                  <ChevronRight size={13} />
                </button>
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {effectiveMode === "capture" && isSelectedNoteLive && (
              <button
                onClick={() => canProcess && persistMode("process")}
                disabled={!canProcess}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-400 dark:hover:bg-violet-950/20"
              >
                Process
              </button>
            )}

            {effectiveMode !== "list" && (
              <button
                onClick={() => persistMode("list")}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
                title="Browse all notes"
                aria-label="Browse all notes"
              >
                <Clock size={16} />
              </button>
            )}

            <button
              onClick={handleNew}
              disabled={creating}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5 dark:hover:text-gray-200"
              title="New note"
              aria-label="New note"
            >
              <Plus size={16} />
            </button>

            {effectiveMode === "capture" && isSelectedNoteLive && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
                  aria-label="More options"
                >
                  <MoreHorizontal size={16} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-black/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
                      <button
                        onClick={handleDiscard}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
                      >
                        <Trash2 size={13} />
                        Discard note
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={closePanel}
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
          ) : effectiveMode === "capture" ? (
            <QuickNoteCapture />
          ) : (
            <QuickNoteProcess />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
