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

export function filterIdeaTree(
  tree: IdeaNode[],
  ideas: Idea[],
  options: { search?: string; hideClosed?: boolean } = {},
): IdeaNode[] {
  const { search = "", hideClosed = false } = options;

  if (!search.trim() && !hideClosed) return tree;

  const passingIds = new Set<string>();
  for (const idea of ideas) {
    let passes = true;
    if (hideClosed && (idea.status === "cancelled" || idea.status === "archived")) passes = false;
    if (passes) passingIds.add(idea.id);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    const matchesSearch = (idea: Idea): boolean => {
      if (idea.text.toLowerCase().includes(q)) return true;
      return ideas.some((child) => child.parent_id === idea.id && matchesSearch(child));
    };
    for (const idea of ideas) {
      if (matchesSearch(idea)) passingIds.add(idea.id);
    }

    const ancestorIds = new Set<string>();
    const ideaMap = new Map(ideas.map((i) => [i.id, i]));
    for (const id of passingIds) {
      let cur = ideaMap.get(id);
      while (cur?.parent_id) {
        ancestorIds.add(cur.parent_id);
        cur = ideaMap.get(cur.parent_id);
      }
    }
    for (const id of ancestorIds) passingIds.add(id);
  }

  return pruneTreeToIds(tree, passingIds);
}
