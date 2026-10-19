"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, StickyNote, X } from "lucide-react";
import { LAYER_MODAL } from "@/lib/layers";
import { DetailField } from "@/components/brainstorm/IdeaDetailField";
import { PlanSelectionActions } from "./PlanSelectionActions";

export function DetailsEditor({
  value,
  onSave,
  parentId,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
  /** When set, text selections offer "create as child" (project plan flow). */
  parentId?: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null,
  );
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const handleSelectText = useCallback(() => {
    if (!parentId) return;
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: text } = el;
    if (selectionStart !== selectionEnd) {
      const selected = text.slice(selectionStart, selectionEnd);
      if (selected.trim()) {
        setSelection((prev) =>
          prev?.start === selectionStart && prev.end === selectionEnd && prev.text === selected
            ? prev
            : { start: selectionStart, end: selectionEnd, text: selected },
        );
        return;
      }
    }
    setSelection((prev) => (prev === null ? prev : null));
    setSelectionOpen((prev) => (prev ? false : prev));
  }, [parentId]);

  const handleDone = useCallback(() => {
    setSelection(null);
    setSelectionOpen(false);
  }, []);

  return (
    <div>
      <div className="relative">
        <DetailField
          icon={StickyNote}
          value={value}
          placeholder="Add notes… Use as project plan: select text to create tasks."
          multiline
          onSave={onSave}
          textareaRef={textareaRef}
          onSelectText={parentId ? handleSelectText : undefined}
          onChange={parentId ? () => handleDone() : undefined}
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand notes editor"
          title="Expand notes editor"
          className="absolute top-1 right-1 rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          <Maximize2 size={13} />
        </button>
      </div>
      {expanded &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/35 p-4"
            style={{ zIndex: LAYER_MODAL + 1 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setExpanded(false);
            }}
          >
            <div className="flex h-[min(70vh,640px)] min-h-[240px] w-[min(90vw,760px)] min-w-[300px] resize flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
              <div className="flex min-h-0 w-full flex-col p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Notes
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      aria-label="Close expanded notes"
                      title="Close"
                      className="rounded p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                      <Minimize2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      aria-label="Close notes editor"
                      title="Close"
                      className="rounded p-1.5 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 [&_textarea]:h-full [&_textarea]:min-h-0 [&_textarea]:resize-none [&_textarea]:overflow-auto [&>div]:h-full">
                  <DetailField
                    icon={StickyNote}
                    value={value}
                    placeholder="Add notes… Use as project plan: select text to create tasks."
                    multiline
                    onSave={onSave}
                    textareaRef={textareaRef}
                    onSelectText={parentId ? handleSelectText : undefined}
                    onChange={parentId ? () => handleDone() : undefined}
                  />
                </div>
                <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                  ⌘+Enter to save · Esc to close
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {parentId && selection && !selectionOpen && (
        <div className="mt-1.5 flex justify-end">
          <button
            onClick={() => setSelectionOpen(true)}
            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Process selection
          </button>
        </div>
      )}
      {parentId && selection && selectionOpen && (
        <div className="mt-1.5">
          <PlanSelectionActions
            selection={selection.text}
            parentId={parentId}
            onDone={handleDone}
          />
        </div>
      )}
    </div>
  );
}
