"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Idea, IdeaNode } from "@/lib/types";

const STORAGE_KEY = "brainstorm-tree-overrides";
const DEFAULT_EXPAND_DEPTH = 1;

type OverrideState = "expanded" | "collapsed";
export type CreateIdeaPosition = "top" | "bottom";

function loadOverrides(): Map<string, OverrideState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveOverrides(overrides: Map<string, OverrideState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)));
  } catch {}
}

function getDepthMap(ideas: Idea[]): Map<string, number> {
  const depths = new Map<string, number>();
  const childrenOf = new Map<string | null, string[]>();
  for (const idea of ideas) {
    const parentKey = idea.parent_id ?? null;
    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
    childrenOf.get(parentKey)!.push(idea.id);
  }
  const walk = (id: string, depth: number) => {
    depths.set(id, depth);
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1);
  };
  for (const rootId of childrenOf.get(null) ?? []) walk(rootId, 0);
  return depths;
}

function computeCollapsedIds(ideas: Idea[], overrides: Map<string, OverrideState>): Set<string> {
  const depths = getDepthMap(ideas);
  const collapsed = new Set<string>();
  const parents = new Set(ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id));

  for (const id of parents) {
    const depth = depths.get(id) ?? 0;
    const override = overrides.get(id);
    if (override === "expanded") continue;
    if (override === "collapsed" || depth >= DEFAULT_EXPAND_DEPTH) {
      collapsed.add(id);
    }
  }
  return collapsed;
}

function buildTree(ideas: Idea[], collapsedIds: Set<string>): IdeaNode[] {
  const map = new Map<string, IdeaNode>();
  const roots: IdeaNode[] = [];

  for (const idea of ideas) {
    map.set(idea.id, { ...idea, children: [], collapsed: collapsedIds.has(idea.id) });
  }

  for (const idea of ideas) {
    const node = map.get(idea.id)!;
    if (idea.parent_id && map.has(idea.parent_id)) {
      map.get(idea.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: IdeaNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

export function useIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const overridesRef = useRef<Map<string, OverrideState>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    overridesRef.current = loadOverrides();
  }, []);

  useEffect(() => {
    if (ideas.length > 0) {
      setCollapsedIds(computeCollapsedIds(ideas, overridesRef.current));
    }
  }, [ideas]);

  const fetchIdeas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });
    if (data) setIdeas(data as Idea[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadIdeas = async () => {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (data) setIdeas(data as Idea[]);
      setLoading(false);
    };

    void loadIdeas();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const createIdea = async (
    text: string,
    parentId: string | null = null,
    position: CreateIdeaPosition = "bottom"
  ): Promise<string> => {
    if (!user) return "";
    const siblings = ideas.filter((i) => i.parent_id === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) : -1;
    const now = new Date().toISOString();
    const id = uuidv4();
    const sortOrder = position === "top" ? 0 : maxOrder + 1;
    const reorderedSiblings =
      position === "top"
        ? siblings.map((s) => ({ ...s, sort_order: s.sort_order + 1 }))
        : [];
    const idea: Idea = {
      id,
      user_id: user.id,
      parent_id: parentId,
      text,
      type: null,
      area: null,
      effort: null,
      impact: null,
      urgency: null,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };
    setIdeas((prev) =>
      prev
        .map((i) => reorderedSiblings.find((s) => s.id === i.id) ?? i)
        .concat(idea)
    );
    await supabase.from("ideas").insert(idea);
    for (const sibling of reorderedSiblings) {
      await supabase
        .from("ideas")
        .update({ sort_order: sibling.sort_order })
        .eq("id", sibling.id);
    }
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const updatedAt = new Date().toISOString();
    setIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates, updated_at: updatedAt } : i))
    );
    await supabase
      .from("ideas")
      .update({ ...updates, updated_at: updatedAt })
      .eq("id", id);
  };

  const deleteIdea = async (id: string) => {
    const toDelete = new Set<string>();
    const collect = (nodeId: string) => {
      toDelete.add(nodeId);
      ideas.filter((i) => i.parent_id === nodeId).forEach((child) => collect(child.id));
    };
    collect(id);
    setIdeas((prev) => prev.filter((i) => !toDelete.has(i.id)));
    await supabase.from("ideas").delete().eq("id", id);
  };

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const updatedAt = new Date().toISOString();
    const siblings = ideas.filter(
      (i) => i.parent_id === newParentId && i.id !== id
    );
    const reordered = siblings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s, idx) => ({
        ...s,
        sort_order: idx >= newSortOrder ? idx + 1 : idx,
      }));

    setIdeas((prev) =>
      prev.map((i) => {
        if (i.id === id) return { ...i, parent_id: newParentId, sort_order: newSortOrder, updated_at: updatedAt };
        const reorderedItem = reordered.find((r) => r.id === i.id);
        if (reorderedItem) return reorderedItem;
        return i;
      })
    );

    await supabase
      .from("ideas")
      .update({ parent_id: newParentId, sort_order: newSortOrder, updated_at: updatedAt })
      .eq("id", id);

    for (const sibling of reordered) {
      if (sibling.sort_order !== ideas.find((i) => i.id === sibling.id)?.sort_order) {
        await supabase
          .from("ideas")
          .update({ sort_order: sibling.sort_order })
          .eq("id", sibling.id);
      }
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const wasCollapsed = next.has(id);
      if (wasCollapsed) {
        next.delete(id);
        overridesRef.current.set(id, "expanded");
      } else {
        next.add(id);
        overridesRef.current.set(id, "collapsed");
      }
      saveOverrides(overridesRef.current);
      return next;
    });
  };

  const expandAll = () => {
    overridesRef.current.clear();
    const parents = ideas.filter((i) => ideas.some((c) => c.parent_id === i.id));
    for (const p of parents) {
      const depth = getDepthMap(ideas).get(p.id) ?? 0;
      if (depth >= DEFAULT_EXPAND_DEPTH) {
        overridesRef.current.set(p.id, "expanded");
      }
    }
    saveOverrides(overridesRef.current);
    setCollapsedIds(new Set());
  };

  const collapseAll = () => {
    overridesRef.current.clear();
    const parents = new Set(ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id));
    for (const id of parents) {
      const depth = getDepthMap(ideas).get(id) ?? 0;
      if (depth < DEFAULT_EXPAND_DEPTH) {
        overridesRef.current.set(id, "collapsed");
      }
    }
    saveOverrides(overridesRef.current);
    setCollapsedIds(parents);
  };

  const tree = buildTree(ideas, collapsedIds);

  return {
    ideas,
    tree,
    loading,
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    toggleCollapse,
    expandAll,
    collapseAll,
    refetch: fetchIdeas,
  };
}
