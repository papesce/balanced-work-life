"use client";

import { useRef, useEffect, useCallback } from "react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";
import { QuickNoteSaveIndicator } from "./QuickNoteSaveIndicator";

/**
 * Capture mode: a plain textarea. Enter inserts a newline and nothing else.
 * Lazy note creation is handled by the context's updateText.
 * When viewing an archived note, the textarea is read-only.
 */
export function QuickNoteCapture() {
  const { note, draft, updateText, flushNow, isSelectedNoteLive, saveStatus, lastSavedAt } =
    useQuickNoteContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readonly = !isSelectedNoteLive;
  const debugEnabled =
    typeof window !== "undefined" && window.localStorage?.getItem("quicknote-debug") === "1";

  // Autofocus with caret at end (only for editable notes)
  useEffect(() => {
    if (readonly) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [note?.id, readonly]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readonly) return;
      updateText(e.target.value);
    },
    [updateText, readonly],
  );

  const handlePaste = useCallback(() => {
    // Let the default paste happen; onChange persists it via updateText.
    // (Previously this handler only logged to the console.)
  }, []);

  // NOTE: previously the textarea was bound to `draft` with internal
  // `[matched:<id>]` tags stripped for display. The next keystroke then fed
  // the stripped text back through updateText, permanently deleting the
  // match metadata (breaking undo/match linkage). The draft is now bound
  // verbatim — tags stay intact; Process mode renders the pretty view.
  const handleBlur = useCallback(() => {
    if (readonly) return;
    void flushNow();
  }, [flushNow, readonly]);

  return (
    <div className="flex flex-col p-4">
      {readonly && (
        <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
          Read-only
        </p>
      )}
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={handleChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        readOnly={readonly}
        placeholder={readonly ? "This note is archived" : "Capture anything..."}
        className={`h-full min-h-[200px] w-full resize-none bg-transparent text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500 ${readonly ? "cursor-default opacity-70" : ""}`}
        rows={10}
      />
      {!readonly && (
        <div className="mt-2 flex items-center justify-end border-t border-black/5 pt-2 dark:border-white/5">
          <QuickNoteSaveIndicator />
        </div>
      )}
      {debugEnabled && (
        <details className="mt-2 rounded-lg bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <summary className="cursor-pointer font-semibold">Debug log (quicknote-debug=1)</summary>
          <div className="mt-1 font-mono break-all whitespace-pre-wrap">
            {`noteId: ${note?.id ?? "(none)"}\nreadonly: ${String(readonly)}\ndraftLength: ${draft.length}\nsaveStatus: ${saveStatus}\nlastSavedAt: ${lastSavedAt ?? "(never)"}\ndbTextLength: ${note?.text?.length ?? 0}\nupdated_at: ${note?.updated_at ?? "(none)"}`}
          </div>
          <p className="mt-1">
            Open DevTools console and filter for [QuickNote]. Disable with
            localStorage.removeItem(&quot;quicknote-debug&quot;).
          </p>
        </details>
      )}
    </div>
  );
}
