"use client";

import { useState } from "react";
import { AlignLeft, StickyNote, X } from "lucide-react";
import { Idea } from "@/lib/types";

export type IdeaDetailUpdates = { description: string | null; notes: string | null };

function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

const fieldClasses =
  "w-full resize-none rounded-md border border-black/10 bg-white/80 py-1.5 pl-8 pr-2 text-xs leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 field-sizing-content";

function DetailField({
  icon: Icon,
  value,
  placeholder,
  multiline,
  onSave,
}: {
  icon: React.ElementType;
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  onSave: (next: string | null) => void;
}) {
  const [draft, setDraft] = useDraft(value ?? "");

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === (value ?? "").trim()) return;
    onSave(trimmed ? draft.trim() : null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value ?? "");
      e.currentTarget.blur();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Icon
        size={13}
        strokeWidth={2}
        className={`pointer-events-none absolute left-2.5 z-10 text-gray-400 dark:text-gray-500 ${
          multiline ? "top-[0.6rem]" : "top-1/2 -translate-y-1/2"
        }`}
      />
      {multiline ? (
        <textarea
          rows={3}
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${fieldClasses} min-h-[4.5rem]`}
        />
      ) : (
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={fieldClasses}
        />
      )}
    </div>
  );
}

export function IdeaInspector({
  idea,
  onUpdate,
  onClose,
  className = "",
}: {
  idea: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <aside className={className} onClick={(e) => e.stopPropagation()}>
      <div className="glass-card-strong rounded-xl p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-100">
            {idea.text || <span className="text-gray-400 italic">Untitled</span>}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close details"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="space-y-2">
          <DetailField
            icon={AlignLeft}
            value={idea.description}
            placeholder="Add a short description…"
            onSave={(next) => onUpdate(idea.id, { description: next })}
          />
          <DetailField
            icon={StickyNote}
            value={idea.notes}
            placeholder="Add notes…"
            multiline
            onSave={(next) => onUpdate(idea.id, { notes: next })}
          />
        </div>
      </div>
    </aside>
  );
}
