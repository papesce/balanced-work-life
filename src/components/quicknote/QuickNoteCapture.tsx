"use client";

import { useRef, useEffect, useCallback } from "react";
import { useQuickNoteContext } from "@/contexts/QuickNoteContext";

/**
 * Capture mode: a plain textarea. Enter inserts a newline and nothing else.
 * Lazy note creation is handled by the context's updateText.
 * When viewing an archived note, the textarea is read-only.
 */
export function QuickNoteCapture() {
  const { note, draft, updateText, flushNow, isSelectedNoteLive } = useQuickNoteContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readonly = !isSelectedNoteLive;

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

  // Strip [matched:UUID] tags for display — they are internal metadata
  const displayDraft = draft.replace(/\[matched:[^\]]+\]\s*/g, "");

  const handleBlur = useCallback(() => {
    if (readonly) return;
    flushNow();
  }, [flushNow, readonly]);

  return (
    <div className="p-4">
      {readonly && (
        <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
          Read-only
        </p>
      )}
      <textarea
        ref={textareaRef}
        value={displayDraft}
        onChange={handleChange}
        onBlur={handleBlur}
        readOnly={readonly}
        placeholder={readonly ? "This note is archived" : "Capture anything..."}
        className={`h-full min-h-[200px] w-full resize-none bg-transparent text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-200 dark:placeholder:text-gray-500 ${readonly ? "cursor-default opacity-70" : ""}`}
        rows={10}
      />
    </div>
  );
}
