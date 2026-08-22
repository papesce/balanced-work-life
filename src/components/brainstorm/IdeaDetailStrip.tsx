"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const CLAMP_LENGTH = 160;

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

function DetailSection({ label, text }: { label: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > CLAMP_LENGTH;
  const displayText = expanded || !isLong ? text : `${text.slice(0, CLAMP_LENGTH).trimEnd()}…`;

  return (
    <div>
      <span className="text-[10px] font-bold tracking-wide text-gray-400 uppercase dark:text-gray-500">
        {label}
      </span>
      <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-200">
        {displayText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold text-indigo-500 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
        >
          {expanded ? (
            <>
              <ChevronUp size={10} strokeWidth={2.5} />
              Less
            </>
          ) : (
            <>
              <ChevronDown size={10} strokeWidth={2.5} />
              More
            </>
          )}
        </button>
      )}
    </div>
  );
}

const inputClasses =
  "w-full resize-none rounded-md border border-black/10 bg-white/80 px-2 py-1 text-xs leading-relaxed text-gray-700 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 field-sizing-content";

function DetailEditField({
  label,
  value,
  placeholder,
  multiline,
  onSave,
}: {
  label: string;
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
    <div>
      <span className="text-[10px] font-bold tracking-wide text-gray-400 uppercase dark:text-gray-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={2}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${inputClasses} mt-0.5 min-h-[2.9375rem]`}
        />
      ) : (
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${inputClasses} mt-0.5`}
        />
      )}
    </div>
  );
}

export function IdeaDetailStrip({
  description,
  notes,
  editable = false,
  onSave,
}: {
  description: string | null;
  notes: string | null;
  editable?: boolean;
  onSave?: (updates: IdeaDetailUpdates) => void;
}) {
  if (editable && onSave) {
    return (
      <div
        role="region"
        aria-label="Details"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="mt-1 mb-1 ml-6 space-y-2 rounded-lg border-l-2 border-indigo-300 bg-white/50 px-3 py-2 shadow-sm dark:border-indigo-500/60 dark:bg-gray-800/40"
      >
        <DetailEditField
          label="Description"
          value={description}
          placeholder="Add a short description…"
          onSave={(next) => onSave({ ...{ description, notes }, description: next })}
        />
        <DetailEditField
          label="Notes"
          value={notes}
          placeholder="Add notes…"
          multiline
          onSave={(next) => onSave({ ...{ description, notes }, notes: next })}
        />
      </div>
    );
  }

  if (!description?.trim() && !notes?.trim()) return null;

  return (
    <div
      role="region"
      aria-label="Details"
      onClick={(e) => e.stopPropagation()}
      className="mt-1 mb-1 ml-6 space-y-2 rounded-lg border-l-2 border-indigo-200 bg-white/50 px-3 py-2 shadow-sm dark:border-indigo-500/40 dark:bg-gray-800/40"
    >
      {description?.trim() && <DetailSection label="Description" text={description} />}
      {notes?.trim() && (
        <div
          className={description?.trim() ? "border-t border-black/5 pt-2 dark:border-white/5" : ""}
        >
          <DetailSection label="Notes" text={notes} />
        </div>
      )}
    </div>
  );
}
