"use client";

import { useState, useCallback } from "react";

export interface UndoAction {
  label: string;
  run: () => Promise<void>;
}

export function useUndoAction() {
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const registerUndo = useCallback((undo: UndoAction) => setUndoAction(undo), []);
  const clearUndo = useCallback(() => setUndoAction(null), []);
  const handleUndo = useCallback(async () => {
    if (!undoAction) return;
    const action = undoAction;
    setUndoAction(null);
    await action.run();
  }, [undoAction]);
  return { undoAction, registerUndo, clearUndo, handleUndo };
}
