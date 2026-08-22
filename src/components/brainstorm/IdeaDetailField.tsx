"use client";

import { useState } from "react";

export function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}

export const fieldClasses =
  "w-full resize-none rounded-md border border-black/10 bg-white/80 py-1.5 pl-8 pr-2 text-xs leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 field-sizing-content";

export function DetailField({
  icon: Icon,
  value,
  placeholder,
  multiline,
  commitOnBlur = true,
  /** Notified on every keystroke so callers can mirror the field's internal draft. */
  onChange,
  onSave,
}: {
  icon: React.ElementType;
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  /** When false the field never self-commits; callers control saving (e.g. Done/Cancel). */
  commitOnBlur?: boolean;
  onChange?: (next: string) => void;
  onSave: (next: string | null) => void;
}) {
  const [draft, setDraft] = useDraft(value ?? "");

  const commit = () => {
    const trimmed = draft.trim();
    if (!commitOnBlur || trimmed === (value ?? "").trim()) return;
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
          onChange={(e) => {
            setDraft(e.target.value);
            onChange?.(e.target.value);
          }}
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
          onChange={(e) => {
            setDraft(e.target.value);
            onChange?.(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={fieldClasses}
        />
      )}
    </div>
  );
}
