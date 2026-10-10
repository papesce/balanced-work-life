import type { Idea } from "@/lib/types";

/**
 * Sort order that appends an idea at the end of the top level.
 * Takes the max root sort_order (excluding the moved idea itself) so the
 * moved item lands after all current roots even when orders have gaps.
 */
export function topLevelSortOrder(ideas: Idea[], id: string): number {
  let max = -1;
  for (const idea of ideas) {
    if (idea.parent_id !== null || idea.id === id) continue;
    if (idea.sort_order > max) max = idea.sort_order;
  }
  return max + 1;
}
