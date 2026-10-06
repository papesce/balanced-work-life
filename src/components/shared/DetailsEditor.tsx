"use client";

import { useCallback, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
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
