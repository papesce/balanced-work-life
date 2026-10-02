"use client";

import { memo, useRef, useEffect, useCallback, useState } from "react";
import { Search } from "lucide-react";
import {
  useQuickNoteEditor,
  useQuickNoteData,
  useQuickNoteCaptureMeta,
} from "@/contexts/QuickNoteContext";
import { QuickNoteSaveIndicator } from "./QuickNoteSaveIndicator";
import { QuickNoteSelectionActions } from "./QuickNoteSelectionActions";
import { requestGlobalSearch } from "@/lib/globalSearchBus";

/**
 * Capture mode: a plain textarea. Enter inserts a newline and nothing else.
 * Lazy note creation is handled by the context's updateText.
 * When viewing an archived note, the textarea is read-only.
 */
export const QuickNoteCapture = memo(function QuickNoteCapture() {
  const { draft, updateText, flushNow } = useQuickNoteEditor();
  const { noteId, isSelectedNoteLive, reopenNote } = useQuickNoteCaptureMeta();
  const { closePanel } = useQuickNoteData();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readonly = !isSelectedNoteLive;
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null,
  );
  const [selectionOpen, setSelectionOpen] = useState(false);
  const selectionRef = useRef(selection);
  const selectionOpenRef = useRef(selectionOpen);
  selectionRef.current = selection;
  selectionOpenRef.current = selectionOpen;

  // Drop stale selection state when switching notes. Reconciled during
  // render (no effect) so it runs exactly once per note id.
  const prevNoteIdRef = useRef(noteId);
  if (noteId !== prevNoteIdRef.current) {
    prevNoteIdRef.current = noteId;
    setSelection(null);
    setSelectionOpen(false);
  }
  // Autofocus with caret at end (only for editable notes)
  useEffect(() => {
    if (readonly) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [noteId, readonly]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readonly) return;
      // Selection actions only exist while the user is selecting text; typing
      // clears them, so skip the state writes when they're already empty
      // (React bails on identical state, this avoids the extra work entirely).
      if (selectionRef.current) setSelection(null);
      if (selectionOpenRef.current) setSelectionOpen(false);
      updateText(e.target.value);
    },
    [updateText, readonly],
  );

  const handlePaste = useCallback(() => {
    // Let the default paste happen; onChange persists it via updateText.
    // (Previously this handler only logged to the console.)
  }, []);

  const handleSelect = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart !== selectionEnd) {
      const text = value.slice(selectionStart, selectionEnd);
      if (text.trim()) {
        setSelection((prev) =>
          prev?.start === selectionStart && prev.end === selectionEnd && prev.text === text
            ? prev
            : { start: selectionStart, end: selectionEnd, text },
        );
        return;
      }
    }
    setSelection((prev) => (prev === null ? prev : null));
    setSelectionOpen((prev) => (prev ? false : prev));
  }, []);

  const handleSelectionDone = useCallback(() => {
    setSelection(null);
    setSelectionOpen(false);
    const el = textareaRef.current;
    if (el) {
      const pos = el.selectionEnd;
      el.setSelectionRange(pos, pos);
    }
  }, []);

  // Send the selection to the global search bar and close the panel
  // (the backdrop would otherwise cover the results dropdown). No mark,
  // no DB writes — pure navigation via existing search behavior.
  const handleSearchSelection = useCallback(async () => {
    if (!selection || !selection.text.trim()) return;
    const query = selection.text;
    handleSelectionDone();
    await closePanel();
    requestGlobalSearch(query);
  }, [selection, handleSelectionDone, closePanel]);

  // Insert a "✓ " mark at the selection start after successful processing.
  // Skipped for archived notes so their text stays pristine. Offsets are
  // safe: typing clears selection state, so the actions UI only exists
  // while the offsets are intact.
  const handleSelectionMarked = useCallback(() => {
    if (readonly || !selection) {
      handleSelectionDone();
      return;
    }
    const marked = draft.slice(0, selection.start) + "✓ " + draft.slice(selection.start);
    updateText(marked);
    setSelection(null);
    setSelectionOpen(false);
    const el = textareaRef.current;
    if (el) {
      const pos = selection.start + 2;
      // Defer so it runs after the controlled value re-renders.
      requestAnimationFrame(() => el.setSelectionRange(pos, pos));
    }
  }, [readonly, selection, draft, updateText, handleSelectionDone]);

  // NOTE: previously the textarea was bound to `draft` with internal
  // `[matched:<id>]` tags stripped for display. The next keystroke then fed
  // the stripped text back through updateText, permanently deleting the
  // match metadata (breaking undo/match linkage). The draft is now bound
  // verbatim — tags stay intact.
  const handleBlur = useCallback(() => {
    if (readonly) return;
    void flushNow();
  }, [flushNow, readonly]);

  return (
    <div className="flex flex-col p-4">
      {readonly && (
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
            Read-only
          </p>
          <button
            onClick={() => void reopenNote()}
            className="rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 transition-colors hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            Reopen note
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onPaste={handlePaste}
        onSelect={handleSelect}
        onBlur={handleBlur}
        readOnly={readonly}
        placeholder={
          readonly
            ? "This note is archived"
            : "Capture anything...\n- Start a line with “- ” to make it a task\n- [Title](notes) adds notes to the created idea\n- End with #project, #task, #goal, #idea or #initiative for the type"
        }
        className={`h-full min-h-[200px] w-full resize-none bg-transparent text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500 ${readonly ? "cursor-default opacity-70" : ""}`}
        rows={10}
      />
      {!readonly && (
        <div className="mt-2 flex items-center justify-end border-t border-black/5 pt-2 dark:border-white/5">
          <QuickNoteSaveIndicator />
        </div>
      )}
      {selection && !selectionOpen && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            onClick={() => void handleSearchSelection()}
            title="Search ideas for the selected text"
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <Search size={13} />
            Search ideas
          </button>
          <button
            onClick={() => setSelectionOpen(true)}
            className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Process selection
          </button>
        </div>
      )}
      {selection && selectionOpen && (
        <div className="mt-2">
          <QuickNoteSelectionActions
            selection={selection.text}
            onMarked={handleSelectionMarked}
            onDone={handleSelectionDone}
          />
        </div>
      )}
    </div>
  );
});
