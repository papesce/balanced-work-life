"use client";

import { useFeedbackStore } from "@/stores/feedbackStore";

export interface UndoAction {
  label: string;
  run: () => Promise<void>;
}

/**
 * Store-backed singleton (Phase 3): every caller shares the same last
 * undoable action, so undo works across views. Same API as before.
 */
export function useUndoAction() {
  const undoAction = useFeedbackStore((s) => s.undoAction);
  const registerUndo = useFeedbackStore((s) => s.registerUndo);
  const clearUndo = useFeedbackStore((s) => s.clearUndo);
  const handleUndo = useFeedbackStore((s) => s.handleUndo);
  return { undoAction, registerUndo, clearUndo, handleUndo };
}
