"use client";

import type { IdeaNode } from "@/lib/types";
import { groupKeyOf } from "@/components/lens/lensUtils";
import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";

export interface PromotedChildRef {
  id: string;
  columnKey: string;
}

/**
 * Single-placement grouping: an item with its own value in the active lens
 * renders in that column; otherwise it nests under its parent. When a child
 * is promoted to a different column than its parent, the parent keeps a trace
 * (promotedByParent) instead of a nested row.
 *
 * Only the top-most differently-classified descendant is promoted; its own
 * unclassified (or same-column) children travel with it.
 */
export function groupTreesByLens(
  allTreeNodes: IdeaNode[],
  valueOf: (ideaId: string) => string | null,
  priorityOf: (ideaId: string) => PriorityValue,
  compare?: (aId: string, bId: string) => number,
): { grouped: Record<string, IdeaNode[]>; promotedByParent: Map<string, PromotedChildRef[]> } {
  const grouped: Record<string, IdeaNode[]> = {};
  const promotedByParent = new Map<string, PromotedChildRef[]>();

  const process = (node: IdeaNode, rootColumnKey: string): IdeaNode => {
    const keptChildren: IdeaNode[] = [];
    for (const child of node.children) {
      const childValue = valueOf(child.id);
      const childColumnKey = groupKeyOf(childValue);
      if (childValue != null && childColumnKey !== rootColumnKey) {
        const promoted = process(child, childColumnKey);
        (grouped[childColumnKey] ??= []).push(promoted);
        const list = promotedByParent.get(node.id) ?? [];
        list.push({ id: child.id, columnKey: childColumnKey });
        promotedByParent.set(node.id, list);
      } else {
        keptChildren.push(process(child, rootColumnKey));
      }
    }
    return { ...node, children: keptChildren };
  };

  for (const node of allTreeNodes) {
    const k = groupKeyOf(valueOf(node.id));
    (grouped[k] ??= []).push(process(node, k));
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      // Injected lens-tiebreaker comparator; without one, fall back to the
      // legacy priority-then-manual order.
      if (compare) return compare(a.id, b.id);
      const rankDiff = priorityRank(priorityOf(a.id)) - priorityRank(priorityOf(b.id));
      if (rankDiff !== 0) return rankDiff;
      return a.sort_order - b.sort_order;
    });
  }
  return { grouped, promotedByParent };
}

/**
 * Secondary-split promotion, run per primary column after groupTreesByLens.
 * A classified child whose secondary value differs from its parent's
 * secondary value is lifted out and becomes a top-level entry of its own
 *SecondarySubGroup in the SAME primary column. Unclassified stays nested.
 * Only the top-most differing descendant promotes; its subtree travels.
 */
export function groupSecondaryByLens(
  pseudoRoots: IdeaNode[],
  secondaryOf: (ideaId: string) => string | null,
): { grouped: Map<string | null, IdeaNode[]>; promotedByParent: Map<string, PromotedChildRef[]> } {
  const grouped = new Map<string | null, IdeaNode[]>();
  const promotedByParent = new Map<string, PromotedChildRef[]>();

  const process = (node: IdeaNode, rootSecKey: string | null): IdeaNode => {
    const keptChildren: IdeaNode[] = [];
    for (const child of node.children) {
      const childSec = secondaryOf(child.id);
      if (childSec != null && childSec !== rootSecKey) {
        const promoted = process(child, childSec);
        const list = grouped.get(childSec) ?? [];
        list.push(promoted);
        grouped.set(childSec, list);
        const refs = promotedByParent.get(node.id) ?? [];
        refs.push({ id: child.id, columnKey: childSec });
        promotedByParent.set(node.id, refs);
      } else {
        keptChildren.push(process(child, rootSecKey));
      }
    }
    return { ...node, children: keptChildren };
  };

  for (const node of pseudoRoots) {
    const k = secondaryOf(node.id);
    const pruned = process(node, k);
    const list = grouped.get(k) ?? [];
    list.push(pruned);
    grouped.set(k, list);
  }
  return { grouped, promotedByParent };
}
