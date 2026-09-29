"use client";

export type QuickNotePanelMode = "capture" | "list";

/** Autosave feedback state for the quick-note editor. */
export type QuickNoteSaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

/** Flush origin tags — every write logs where it was triggered from. */
export type QuickNoteFlushOrigin =
  | "timer"
  | "blur"
  | "close"
  | "select"
  | "create"
  | "selection"
  | "visibility:hidden"
  | "pagehide"
  | "unmount"
  | "unknown";
