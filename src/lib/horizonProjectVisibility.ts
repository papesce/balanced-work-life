"use client";

import type { Idea } from "@/lib/types";

/**
 * Projects hidden by the "Hide projects with visible tasks" rule.
 *
 * A project in the current pool is hidden when at least one descendant
 * (any depth in its branch) is a visible task. Visible = present in the
 * pool (status already passed the Hide closed filter). The check runs
 * against the full pool BEFORE the type filter, and ignores lens values.
 */
export function getHiddenProjectIds(pool: Idea[], allIdeas: Idea[]): Set<string> {
  const poolIds = new Set(pool.map((i) => i.id));
  const byId = new Map(allIdeas.map((i) => [i.id, i]));
  const childrenOf = new Map<string, string[]>();
  for (const idea of allIdeas) {
    if (!idea.parent_id) continue;
    const list = childrenOf.get(idea.parent_id);
    if (list) list.push(idea.id);
    else childrenOf.set(idea.parent_id, [idea.id]);
  }

  const hasVisibleTaskCache = new Map<string, boolean>();

  const subtreeHasVisibleTask = (id: string, visiting: Set<string>): boolean => {
    const cached = hasVisibleTaskCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return false;
    visiting.add(id);
    let found = false;
    for (const childId of childrenOf.get(id) ?? []) {
      const child = byId.get(childId);
      if (!child) continue;
      if (child.type === "task" && poolIds.has(childId)) {
        found = true;
        break;
      }
      if (subtreeHasVisibleTask(childId, visiting)) {
        found = true;
        break;
      }
    }
    visiting.delete(id);
    hasVisibleTaskCache.set(id, found);
    return found;
  };

  const hidden = new Set<string>();
  for (const idea of pool) {
    if (idea.type !== "project") continue;
    if (subtreeHasVisibleTask(idea.id, new Set())) hidden.add(idea.id);
  }
  return hidden;
}
