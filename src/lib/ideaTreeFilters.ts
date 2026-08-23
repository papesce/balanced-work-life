import { IdeaNode, Idea } from "@/lib/types";
import { dropSubtrees, pruneTree, pruneTreeToIds } from "@/components/tree/filterTree";

export function filterTreeBySearch(nodes: IdeaNode[], query: string): IdeaNode[] {
  if (!query.trim()) return nodes;

  const q = query.toLowerCase();
  const matchesSearch = (node: IdeaNode): boolean => {
    if (node.text.toLowerCase().includes(q)) return true;
    if (!node.collapsed) {
      return node.children.some(matchesSearch);
    }
    return false;
  };

  return pruneTree(nodes, matchesSearch);
}

export function filterTreeHideClosed(nodes: IdeaNode[]): IdeaNode[] {
  return dropSubtrees(nodes, (node) => node.status === "cancelled" || node.status === "archived");
}

export function filterTreeByFocus(nodes: IdeaNode[], ideas: Idea[]): IdeaNode[] {
  const ideaMap = new Map(ideas.map((i) => [i.id, i]));
  // Collect all ideas that are in_focus plus their ancestors so tree structure is preserved
  const focusedIds = new Set<string>();
  for (const idea of ideas) {
    if (idea.in_focus) {
      let cur: Idea | undefined = idea;
      while (cur) {
        focusedIds.add(cur.id);
        cur = cur.parent_id ? ideaMap.get(cur.parent_id) : undefined;
      }
    }
  }
  if (focusedIds.size === 0) return [];
  return pruneTreeToIds(nodes, focusedIds);
}

export function filterIdeaTree(
  tree: IdeaNode[],
  ideas: Idea[],
  options: {
    search?: string;
    hideClosed?: boolean;
    hideCompleted?: boolean;
    hideDeferred?: boolean;
  } = {},
): IdeaNode[] {
  const { search = "", hideClosed = false, hideCompleted = false, hideDeferred = false } = options;

  if (!search.trim() && !hideClosed && !hideCompleted && !hideDeferred) return tree;

  const hasHideFilters = hideClosed || hideCompleted || hideDeferred;

  const hidePassedIds = new Set<string>();
  if (hasHideFilters) {
    for (const idea of ideas) {
      let passes = true;
      if (hideClosed && (idea.status === "cancelled" || idea.status === "archived")) passes = false;
      if (hideCompleted && idea.status === "completed") passes = false;
      if (hideDeferred && idea.status === "deferred") passes = false;
      if (passes) hidePassedIds.add(idea.id);
    }
  }

  if (!search.trim()) {
    return pruneTreeToIds(tree, hidePassedIds);
  }

  const q = search.toLowerCase();
  const matchesSearch = (idea: Idea): boolean => {
    if (idea.text.toLowerCase().includes(q)) return true;
    if (idea.description?.toLowerCase().includes(q)) return true;
    if (idea.notes?.toLowerCase().includes(q)) return true;
    return ideas.some((child) => child.parent_id === idea.id && matchesSearch(child));
  };

  const matchedIds = new Set<string>();
  for (const idea of ideas) {
    if (matchesSearch(idea)) matchedIds.add(idea.id);
  }

  const visibleSearchIds = new Set(matchedIds);
  const ideaMap = new Map(ideas.map((i) => [i.id, i]));
  for (const id of matchedIds) {
    let cur = ideaMap.get(id);
    while (cur?.parent_id) {
      visibleSearchIds.add(cur.parent_id);
      cur = ideaMap.get(cur.parent_id);
    }
  }

  const finalIds = new Set<string>();
  for (const id of visibleSearchIds) {
    if (!hasHideFilters || hidePassedIds.has(id)) finalIds.add(id);
  }
  return pruneTreeToIds(tree, finalIds);
}
