"use client";

import type { Idea } from "@/lib/types";

export function getHiddenChildProjectIds(pool: Idea[], allIdeas: Idea[]): Set<string> {
  const poolIds = new Set(pool.map((i) => i.id));
  const byId = new Map(allIdeas.map((i) => [i.id, i]));
  const hiddenCache = new Map<string, boolean>();

  const isHidden = (id: string, visiting: Set<string>): boolean => {
    const cached = hiddenCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return false;
    const idea = byId.get(id);
    if (!idea || idea.type !== "project" || !idea.parent_id) return false;
    if (idea.parent_id === id) return false;
    if (!poolIds.has(id)) return false;
    const parent = byId.get(idea.parent_id);
    if (!parent || parent.type !== "project") return false;
    if (!poolIds.has(parent.id)) return false;
    visiting.add(id);
    const parentHidden = isHidden(parent.id, visiting);
    visiting.delete(id);
    const result = !parentHidden; // hidden if parent visible
    hiddenCache.set(id, result);
    return result;
  };

  const hidden = new Set<string>();
  for (const idea of pool) {
    if (idea.type !== "project") continue;
    if (isHidden(idea.id, new Set())) hidden.add(idea.id);
  }
  return hidden;
}
