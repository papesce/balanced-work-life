"use client";

import { useEffect, useMemo } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { usePendingOverrides } from "./usePendingOverrides";
import { useIdeaCollapse } from "./useIdeaCollapse";
import { useIdeaCrud } from "./useIdeaCrud";
import { useIdeaOrder } from "./useIdeaOrder";
import { useIdeaStatus } from "./useIdeaStatus";
import { buildScopedQuery, deserializeIdea } from "@/lib/ideaModel";
import type { Idea } from "@/lib/types";

export type IdeasScope = "all" | "this_month";
/**
 * Where a newly created idea lands among its siblings:
 * - "top"/"bottom": absolute start/end of the sibling list
 * - { beforeId } / { afterId }: directly before/after the anchor sibling
 */
export type CreateIdeaPosition = "top" | "bottom" | { beforeId: string } | { afterId: string };

export function useIdeas(options: { scope?: IdeasScope; searchQuery?: string } = {}) {
  const { scope = "all", searchQuery = "" } = options;
  const { user } = useAuth();
  const db = usePowerSync();

  const userId = user?.id ?? "";
  const hasSearch = searchQuery.trim().length > 0;
  // While searching, look at every idea regardless of the active time scope.
  const { sql, params } = buildScopedQuery(userId, hasSearch ? "all" : scope);

  const { data: rawRows, isLoading: loading } = useQuery<Record<string, unknown>>(
    userId ? sql : "SELECT * FROM ideas WHERE 0",
    userId ? params : [],
  );

  // Optimistic overlay: applied synchronously in updateIdea so status
  // toggles render instantly instead of waiting for the live query.
  const {
    overrides: pendingIdeas,
    setOverride: setPendingIdea,
    removeOverride: removePendingIdea,
    removeOverridesWhere: removePendingIdeasWhere,
  } = usePendingOverrides<string, Partial<Idea>>();

  const ideas: Idea[] = useMemo(() => {
    const base = rawRows.map(deserializeIdea);
    if (pendingIdeas.size === 0) return base;
    return base.map((idea) => {
      const patch = pendingIdeas.get(idea.id);
      return patch ? { ...idea, ...patch } : idea;
    });
  }, [rawRows, pendingIdeas]);

  // Drop optimistic patches once the live query has converged on them.
  useEffect(() => {
    if (pendingIdeas.size === 0 || rawRows.length === 0) return;
    const liveById = new Map(rawRows.map((r) => [r.id as string, deserializeIdea(r)]));
    removePendingIdeasWhere((id, patch) => {
      const live = liveById.get(id);
      if (!live) return false;
      return (Object.keys(patch) as (keyof Idea)[]).every((key) => {
        const pendingValue = patch[key];
        const liveValue = live[key];
        if (Array.isArray(pendingValue) || Array.isArray(liveValue)) {
          return JSON.stringify(pendingValue ?? null) === JSON.stringify(liveValue ?? null);
        }
        return (pendingValue ?? null) === (liveValue ?? null);
      });
    });
  }, [rawRows, pendingIdeas.size, removePendingIdeasWhere]);

  const { createIdea, updateIdea, deleteIdea, restoreIdeas, createParentAndMove } = useIdeaCrud({
    db,
    userId,
    ideas,
    pendingIdeas,
    setPendingIdea,
    removePendingIdea,
  });

  const { reorderTasks, smartSortTasks, moveIdea } = useIdeaOrder({ db, ideas });

  const {
    markDone,
    markUndone,
    markInProgress,
    markPaused,
    markCancelled,
    markMissed,
    scheduleIdea,
  } = useIdeaStatus({ ideas, updateIdea });

  const { tree, toggleCollapse, expandIdea, expandAll, collapseAll } = useIdeaCollapse({
    ideas,
    rawRowCount: rawRows.length,
    searchQuery,
  });

  return {
    ideas,
    tree,
    loading,
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    createParentAndMove,
    reorderTasks,
    smartSortTasks,
    markDone,
    markUndone,
    markInProgress,
    markPaused,
    markCancelled,
    markMissed,
    scheduleIdea,
    restoreIdeas,
    toggleCollapse,
    expandIdea,
    expandAll,
    collapseAll,
  };
}
