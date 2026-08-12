"use client";

import { motion } from "framer-motion";
import { UndoAction } from "@/lib/tasks/undo";

export function UndoBar({
  undoAction,
  onUndo,
  onDismiss,
}: {
  undoAction: UndoAction | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (!undoAction) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card mb-3 flex items-center justify-between gap-3 rounded-[16px] border-amber-200/40 px-4 py-2.5 dark:border-amber-700/30"
    >
      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
        {undoAction.label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onUndo}
          className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-900/20"
        >
          Undo
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss undo"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-100/60 dark:text-amber-400 dark:hover:bg-amber-900/20"
        >
          <span className="text-sm">&times;</span>
        </button>
      </div>
    </motion.div>
  );
}
