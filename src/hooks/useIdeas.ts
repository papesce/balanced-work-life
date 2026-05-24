"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Idea, IdeaNode, IdeaType, LifeArea } from "@/lib/types";

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
  const [loading, setLoading] = useState(true);

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
    fetchIdeas();
  }, [fetchIdeas]);

  const createIdea = async (text: string, parentId: string | null = null): Promise<string> => {
    if (!user) return "";
    const siblings = ideas.filter((i) => i.parent_id === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sort_order)) : -1;
    const now = new Date().toISOString();
    const id = uuidv4();
    const idea: Idea = {
      id,
      user_id: user.id,
      parent_id: parentId,
      text,
      type: null,
      area: null,
      sort_order: maxOrder + 1,
      created_at: now,
      updated_at: now,
    };
    setIdeas((prev) => [...prev, idea]);
    await supabase.from("ideas").insert(idea);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());

  const collapseAll = () => {
    const parents = new Set(ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id));
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
