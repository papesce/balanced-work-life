"use client";

import { X } from "lucide-react";
import { LINK_TYPES, LINK_TYPE_LABELS } from "@/lib/linkTypes";
import type { LinkType } from "@/lib/types";

export function WorkflowEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
      <div className="max-w-xs rounded-xl bg-white/90 p-5 shadow dark:bg-gray-800/90">
        <p className="text-sm font-semibold">This path is empty</p>
        <p className="mt-1 text-xs text-gray-500">
          Drag tasks from the TASKS list onto the canvas, then connect them in the order they
          happen.
        </p>
      </div>
    </div>
  );
}

export function WorkflowMessage({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow">
      {message}
      <button className="ml-2" onClick={onDismiss} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  );
}

export function PendingLinkPicker({
  sourceText,
  targetText,
  onConfirm,
  onCancel,
}: {
  sourceText: string;
  targetText: string;
  onConfirm: (linkType: LinkType) => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute top-3 left-1/2 w-[min(420px,90%)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-semibold">
        Link “{sourceText}” → “{targetText}” as…
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Arrow stays in the drawn direction; “Depends on” is stored flipped (target depends on
        source).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {LINK_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onConfirm(value)}
            title={LINK_TYPE_LABELS[value]}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:hover:border-violet-500/40 dark:hover:bg-violet-500/10"
          >
            {label}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-2 text-[11px] text-gray-400 hover:text-gray-600">
        Cancel
      </button>
    </div>
  );
}
