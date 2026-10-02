"use client";

export type QuickNotePanelMode = "capture" | "list";

/** Autosave feedback state for the quick-note editor. */
export type QuickNoteSaveStatus = "idle" | "editing" | "saving" | "saved" | "error";
