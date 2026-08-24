"use client";

import { FileText } from "lucide-react";

export function NotesIndicator({
  hasNotes,
  onClick,
  size = 12,
}: {
  hasNotes: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: number;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={hasNotes ? "Edit notes" : "Add notes"}
      title={hasNotes ? "Edit notes" : "Add notes"}
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors ${
        hasNotes
          ? "text-indigo-400 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
          : "text-gray-300 hover:bg-black/5 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-400"
      }`}
    >
      <FileText
        size={size}
        strokeWidth={hasNotes ? 2 : 1.5}
        className={hasNotes ? "fill-indigo-400/20" : ""}
      />
    </button>
  );
}
