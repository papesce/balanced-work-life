import { buildTree as buildTreeGeneric } from "@/components/tree/buildTree";
import { getHiddenProjectIds } from "@/lib/horizonProjectVisibility";
import { filterOutOverdue, filterOutUpcoming } from "@/lib/horizonScope";
import type { Idea, IdeaNode } from "@/lib/types";

export const ACTIVE_STATUSES = new Set(["draft", "planned", "in_progress", "scheduled"]);

export function compareIdeasForTree(a: Idea, b: Idea): number {
  const aDone = a.completed_at ? 1 : 0;
  const bDone = b.completed_at ? 1 : 0;
  if (aDone !== bDone) return aDone - bDone;
  return a.sort_order - b.sort_order;
}

export function buildFilteredTree(
  ideas: Idea[],
  collapsedIds: Set<string>,
  hideClosed: boolean,
  hideProjectsWithTasks: boolean,
  hideUpcoming: boolean,
  hideOverdue: boolean,
): IdeaNode[] {
  let pool = hideClosed ? ideas.filter((i) => ACTIVE_STATUSES.has(i.status)) : ideas;
  if (hideUpcoming) pool = filterOutUpcoming(pool);
  if (hideOverdue) pool = filterOutOverdue(pool);
  if (hideProjectsWithTasks) {
    const hidden = getHiddenProjectIds(pool, ideas);
    if (hidden.size > 0) pool = pool.filter((i) => !hidden.has(i.id));
  }

  const poolIds = new Set(pool.map((i) => i.id));
  const byId = new Map(pool.map((i) => [i.id, i] as const));
  const childIds = new Set(
    pool.filter((i) => i.parent_id && poolIds.has(i.parent_id)).map((i) => i.id),
  );
  // Every root is in scope: classified roots group by value under the
  // active lens, the rest form the explicit unclassified group
  // (never hidden, never defaulted).
  const rootIds = pool.filter((i) => !childIds.has(i.id)).map((i) => i.id);
  const rootSet = new Set(rootIds);

  const included = pool.filter((i) => {
    if (rootSet.has(i.id)) return true;
    let cur = i;
    while (cur.parent_id && poolIds.has(cur.parent_id)) {
      const parent = byId.get(cur.parent_id);
      if (!parent) break;
      cur = parent;
      if (rootSet.has(cur.id)) return true;
    }
    return false;
  });

  return buildTreeGeneric(included, collapsedIds, compareIdeasForTree);
}
