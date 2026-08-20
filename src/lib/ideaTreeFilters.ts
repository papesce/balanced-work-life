import { IdeaNode, Idea } from "@/lib/types";

export function filterTreeBySearch(nodes: IdeaNode[], query: string): IdeaNode[] {
  if (!query.trim()) return nodes;

  const matchesSearch = (node: IdeaNode): boolean => {
    const q = query.toLowerCase();
    if (node.text.toLowerCase().includes(q)) return true;
    if (!node.collapsed) {
      return node.children.some(matchesSearch);
    }
    return false;
  };

  const prune = (node: IdeaNode): IdeaNode | null => {
    if (!matchesSearch(node)) return null;
    const children = node.children.map(prune).filter(Boolean) as IdeaNode[];
    return { ...node, children };
  };

  return nodes.map(prune).filter(Boolean) as IdeaNode[];
}

export function filterTreeHideClosed(nodes: IdeaNode[]): IdeaNode[] {
  const prune = (node: IdeaNode): IdeaNode | null => {
    if (node.status === "cancelled" || node.status === "archived") return null;
    const children = node.children.map(prune).filter(Boolean) as IdeaNode[];
    return { ...node, children };
  };

  return nodes.map(prune).filter(Boolean) as IdeaNode[];
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

  const prune = (node: IdeaNode): IdeaNode | null => {
    if (!passingIds.has(node.id)) return null;
    const children = node.children.map(prune).filter(Boolean) as IdeaNode[];
    return { ...node, children };
  };

  return tree.map(prune).filter(Boolean) as IdeaNode[];
}
