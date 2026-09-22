"use client";

export type ResolveAction =
  | { type: "create"; expectedText: string; text: string }
  | { type: "create_under"; expectedText: string; parentId: string; text: string }
  | { type: "match"; expectedText: string; ideaId: string }
  | { type: "discard"; expectedText: string };

export type QuickNotePanelMode = "capture" | "process" | "list";

/** Autosave feedback state for the quick-note editor. */
export type QuickNoteSaveStatus = "idle" | "editing" | "saving" | "saved" | "error";

/** Flush origin tags — every write logs where it was triggered from. */
export type QuickNoteFlushOrigin =
  | "timer"
  | "blur"
  | "close"
  | "select"
  | "create"
  | "resolve"
  | "visibility:hidden"
  | "pagehide"
  | "unmount"
  | "unknown";
