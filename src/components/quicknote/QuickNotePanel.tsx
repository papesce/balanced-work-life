"use client";

/* eslint-disable react-hooks/set-state-in-effect -- standard pattern for resetting state on prop change */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, FileText, MoreHorizontal, Trash2, ChevronLeft, Clock } from "lucide-react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { QuickNoteCapture } from "./QuickNoteCapture";
import { QuickNoteProcess } from "./QuickNoteProcess";
import { QuickNoteList } from "./QuickNoteList";

type PanelMode = "capture" | "process" | "list";

const MODE_STORAGE_KEY = "quicknote-panel-mode";
const VALID_MODES: PanelMode[] = ["capture", "process", "list"];

function readStoredMode(): PanelMode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored && VALID_MODES.includes(stored as PanelMode)) return stored as PanelMode;
  } catch {}
  return "capture";
}

export function QuickNotePanel() {
  const { note, panelOpen, closePanel, discardNote, unreadCount, isSelectedNoteLive } =
    useQuickNoteContext();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<PanelMode>("capture");
  const [menuOpen, setMenuOpen] = useState(false);

  // Persist mode to localStorage
  const persistMode = useCallback((next: PanelMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {}
  }, []);

  useEffect(() => {
    setMode(readStoredMode());
    setMounted(true);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen, closePanel]);

  // Reset menu when panel opens
  useEffect(() => {
    if (panelOpen) {
      setMenuOpen(false);
    }
  }, [panelOpen]);

  const handleDiscard = useCallback(async () => {
    setMenuOpen(false);
    await discardNote();
    closePanel();
  }, [discardNote, closePanel]);

  if (!mounted || !panelOpen) return null;

  const canProcess = note && unreadCount > 0 && isSelectedNoteLive;

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
          <div className="flex items-center gap-2">
            {mode === "list" ? (
              <button
                onClick={() => persistMode("capture")}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            ) : mode === "process" ? (
              <button
                onClick={() => persistMode("capture")}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>
            ) : (
              <>
                <FileText size={16} className="text-violet-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {isSelectedNoteLive ? "Quick Note" : "Archived Note"}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {mode === "capture" && isSelectedNoteLive && (
              <button
                onClick={() => canProcess && persistMode("process")}
                disabled={!canProcess}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-400 dark:hover:bg-violet-950/20"
              >
                Process
              </button>
            )}

            {mode !== "list" && (
              <button
                onClick={() => {
                  persistMode("list");
                  setMenuOpen(false);
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
                title="Browse all notes"
                aria-label="Browse all notes"
              >
                <Clock size={16} />
              </button>
            )}

            {mode === "capture" && isSelectedNoteLive && (
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
          {mode === "list" ? (
            <QuickNoteList />
          ) : mode === "capture" ? (
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
