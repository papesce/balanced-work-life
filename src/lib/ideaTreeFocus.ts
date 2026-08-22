import { Idea } from "@/lib/types";

/** Chain of ancestors of `ideaId`, ordered root → immediate parent (excludes the idea itself). */
export function getAncestorChain(ideaId: string, ideas: Idea[]): Idea[] {
  const byId = new Map(ideas.map((i) => [i.id, i]));
  const chain: Idea[] = [];
  let current = byId.get(ideaId);
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

/** All ids in the subtree rooted at `rootId`, including the root itself. */
export function getFocusedSubtreeIds(rootId: string, ideas: Idea[]): Set<string> {
  const ids = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  for (const idea of ideas) {
    if (!idea.parent_id) continue;
    const siblings = childrenOf.get(idea.parent_id);
    if (siblings) siblings.push(idea.id);
    else childrenOf.set(idea.parent_id, [idea.id]);
  }
  const collect = (id: string) => {
    ids.add(id);
    for (const child of childrenOf.get(id) ?? []) collect(child);
  };
  collect(rootId);
  return ids;
}

/** Number of direct children of `ideaId`. */
export function getChildCount(ideaId: string, ideas: Idea[]): number {
  return ideas.filter((i) => i.parent_id === ideaId).length;
}
