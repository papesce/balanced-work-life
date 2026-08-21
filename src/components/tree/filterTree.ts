import type { TreeItem, TreeNode } from "./types";

/**
 * Keeps nodes matching `keep`, plus every ancestor of a kept node.
 * A node with a falsy predicate survives only if it still has kept children.
 */
export function pruneTree<T extends TreeItem>(
  nodes: TreeNode<T>[],
  keep: (node: TreeNode<T>) => boolean,
): TreeNode<T>[] {
  const prune = (node: TreeNode<T>): TreeNode<T> | null => {
    const children = node.children.map(prune).filter(Boolean) as TreeNode<T>[];
    if (!keep(node) && children.length === 0) return null;
    return { ...node, children };
  };
  return nodes.map(prune).filter(Boolean) as TreeNode<T>[];
}

/**
 * Keeps only the nodes whose id is in `visibleIds` (ancestors must be added
 * to the set by the caller if they should remain visible).
 */
export function pruneTreeToIds<T extends TreeItem>(
  nodes: TreeNode<T>[],
  visibleIds: Set<string>,
): TreeNode<T>[] {
  const prune = (node: TreeNode<T>): TreeNode<T> | null => {
    if (!visibleIds.has(node.id)) return null;
    const children = node.children.map(prune).filter(Boolean) as TreeNode<T>[];
    return { ...node, children };
  };
  return nodes.map(prune).filter(Boolean) as TreeNode<T>[];
}

/** Drops any node matching `drop` together with its whole subtree. */
export function dropSubtrees<T extends TreeItem>(
  nodes: TreeNode<T>[],
  drop: (node: TreeNode<T>) => boolean,
): TreeNode<T>[] {
  const walk = (node: TreeNode<T>): TreeNode<T> | null => {
    if (drop(node)) return null;
    const children = node.children.map(walk).filter(Boolean) as TreeNode<T>[];
    return { ...node, children };
  };
  return nodes.map(walk).filter(Boolean) as TreeNode<T>[];
}
