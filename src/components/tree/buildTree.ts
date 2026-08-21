import type { TreeItem, TreeNode } from "./types";

/**
 * Build a nested tree from a flat list of items.
 * Items whose `parent_id` is null or missing from the list become roots.
 */
export function buildTree<T extends TreeItem>(
  items: T[],
  collapsedIds?: Set<string>,
  compare?: (a: T, b: T) => number,
): TreeNode<T>[] {
  const map = new Map<string, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [], collapsed: collapsedIds?.has(item.id) ?? false });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  if (compare) {
    const sortNodes = (nodes: TreeNode<T>[]) => {
      nodes.sort(compare);
      for (const node of nodes) sortNodes(node.children);
    };
    sortNodes(roots);
  }

  return roots;
}

export function itemsById<T extends TreeItem>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Walks up the parent chain to check whether `candidateId` sits inside `ancestorId`'s subtree. */
export function isDescendantOf(
  byId: Map<string, TreeItem>,
  candidateId: string,
  ancestorId: string,
): boolean {
  let current = byId.get(candidateId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = byId.get(current.parent_id);
  }
  return false;
}

/** All ids in the subtree rooted at `rootId`, including the root itself. */
export function getDescendantIds<T extends TreeItem>(items: T[], rootId: string): Set<string> {
  const ids = new Set<string>();
  const childrenOf = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parent_id) continue;
    const siblings = childrenOf.get(item.parent_id);
    if (siblings) siblings.push(item.id);
    else childrenOf.set(item.parent_id, [item.id]);
  }
  const collect = (id: string) => {
    ids.add(id);
    for (const child of childrenOf.get(id) ?? []) collect(child);
  };
  collect(rootId);
  return ids;
}
