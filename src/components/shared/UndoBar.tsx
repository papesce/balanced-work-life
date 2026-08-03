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
      className="mb-3 flex items-center justify-between gap-3 rounded-[16px] glass-card border-amber-200/40 dark:border-amber-700/30 px-4 py-2.5"
    >
      <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">{undoAction.label}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onUndo}
          className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
        >
          Undo
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss undo"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
        >
          <span className="text-sm">&times;</span>
        </button>
      </div>
    </motion.div>
  );
}
