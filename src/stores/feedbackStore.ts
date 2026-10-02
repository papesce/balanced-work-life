"use client";

import { create } from "zustand";
import type { CompletionEffects } from "@/lib/linkEffects";
import type { UndoAction } from "@/lib/tasks/undo";

export interface CompletionFeedback {
  effects: CompletionEffects;
  completedText: string;
}

interface FeedbackState {
  undoAction: UndoAction | null;
  completionEffects: CompletionFeedback | null;
  registerUndo: (action: UndoAction) => void;
  clearUndo: () => void;
  handleUndo: () => Promise<void>;
  setCompletionEffects: (feedback: CompletionFeedback | null) => void;
}

/**
 * Global singleton for transient user feedback (Phase 3).
 * Previously each page + QuickNote owned its own `useUndoAction` state, so an
 * undo registered on one view was invisible on another. One store means the
 * last mutation is undoable from anywhere, and completion toasts survive
 * route changes. Never persisted — undo closures aren't serializable.
 */
export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  undoAction: null,
  completionEffects: null,
  registerUndo: (action) => set({ undoAction: action }),
  clearUndo: () => set({ undoAction: null }),
  handleUndo: async () => {
    const action = get().undoAction;
    if (!action) return;
    set({ undoAction: null });
    await action.run();
  },
  setCompletionEffects: (feedback) => set({ completionEffects: feedback }),
}));

/** Shared completion toast — replaces per-page `useState` copies. */
export function useCompletionEffects() {
  const completionEffects = useFeedbackStore((s) => s.completionEffects);
  const setCompletionEffects = useFeedbackStore((s) => s.setCompletionEffects);
  return { completionEffects, setCompletionEffects };
}
