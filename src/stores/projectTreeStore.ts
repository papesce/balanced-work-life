"use client";

import { create } from "zustand";
import { buildProjectTree, type ProjectTree } from "@/hooks/useProjectActions";
import type { Idea } from "@/lib/types";

interface ProjectTreeState {
  /** Last ideas array reference fed into the store. */
  ideas: Idea[];
  /** Computed once per ideas change — shared across pages. */
  tree: ProjectTree;
  setIdeas: (ideas: Idea[]) => void;
  statOf: (id: string) => { done: number; total: number; direct: number; nextId: string | null };
  childrenOf: (id: string) => Idea[];
}

const EMPTY_TREE: ProjectTree = { stats: new Map(), childrenById: new Map() };

export const useProjectTreeStore = create<ProjectTreeState>()((set, get) => ({
  ideas: [],
  tree: EMPTY_TREE,
  setIdeas: (ideas) => {
    // Skip O(N) rebuild when PowerSync returns an identical reference.
    if (get().ideas === ideas) return;
    set({ ideas, tree: buildProjectTree(ideas) });
  },
  statOf: (id) => get().tree.stats.get(id) ?? { done: 0, total: 0, direct: 0, nextId: null },
  childrenOf: (id) => get().tree.childrenById.get(id) ?? [],
}));

/** Subscribe to stats for one node — re-renders only when the tree object changes. */
export function useProjectStat(id: string) {
  return useProjectTreeStore((s) => s.tree.stats.get(id));
}

/** Subscribe to the whole tree (list view). Prefer useProjectStat/children hooks in rows. */
export function useProjectTree() {
  return useProjectTreeStore((s) => s.tree);
}
