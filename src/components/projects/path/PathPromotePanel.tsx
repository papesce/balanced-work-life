"use client";

import { useState } from "react";

interface Props {
  item: { title: string; ideaId: string | null };
  onPromote: (title: string) => Promise<void>;
  onCancel: () => void;
  isPromoting: boolean;
  setPromoting: () => void;
}

export function PathPromotePanel({ item, onPromote, onCancel, isPromoting, setPromoting }: Props) {
  const [draft, setDraft] = useState(item.title);
  const [submitting, setSubmitting] = useState(false);

  if (!isPromoting) {
    return (
      <button
        type="button"
        onClick={setPromoting}
        aria-label="Create task from this step"
        className="flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold text-violet-600 shadow-lg hover:bg-violet-50 dark:border-gray-700 dark:bg-gray-800"
      >
        Create task from step
      </button>
    );
  }

  return (
    <div className="glass-card-strong min-w-[200px] rounded-xl border border-violet-200 p-3 shadow-xl dark:border-violet-800">
      <p className="mb-2 text-[11px] font-bold text-gray-500 uppercase">Create task from step</p>
      <input
        autoFocus
        aria-label="Task name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-900"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            setSubmitting(true);
            try {
              await onPromote(draft);
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting || !draft.trim()}
          className="rounded-lg bg-violet-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
