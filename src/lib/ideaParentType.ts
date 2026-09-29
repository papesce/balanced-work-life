"use client";

import type { IdeaType } from "@/lib/types";

/** All selectable parent types for the "Create … as <type>" row. */
export const PARENT_TYPE_OPTIONS: IdeaType[] = [
  "objective",
  "project",
  "initiative",
  "task",
  "idea",
];

/**
 * Most natural parent type for the item being moved.
 * task → project, project → objective, initiative → objective,
 * objective → objective, idea (or null) → project.
 */
export function getDefaultParentType(childType: IdeaType | null | undefined): IdeaType {
  switch (childType) {
    case "task":
      return "project";
    case "project":
    case "initiative":
    case "objective":
      return "objective";
    case "idea":
    default:
      return "project";
  }
}

/** Show the create-row only when the query isn't an exact match of a visible idea. */
export function hasExactMatch(ideas: { text: string }[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return ideas.some((idea) => idea.text.trim().toLowerCase() === normalized);
}
