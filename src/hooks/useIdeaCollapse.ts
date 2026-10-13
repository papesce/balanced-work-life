"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildIdeaTree,
  computeCollapsedIds,
  DEFAULT_EXPAND_DEPTH,
  getDepthMap,
} from "@/lib/ideaModel";
import {
  STORAGE_KEYS,
  readTreeOverrides,
  writeTreeOverrides,
  type AppStorageKey,
} from "@/lib/storage";
import type { Idea } from "@/lib/types";

/**
 * Tree collapse state: collapsedIds derived from depth + persisted
 * overrides, recomputed when the live rows or search change.
 */
export function useIdeaCollapse({
  ideas,
  rawRowCount,
  searchQuery = "",
  storageKey = STORAGE_KEYS.brainstormTreeOverrides,
}: {
  ideas: Idea[];
  /** Live-query row count; drives recomputation without coupling to rows. */
  rawRowCount: number;
  searchQuery?: string;
  storageKey?: AppStorageKey;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const overridesRef = useRef(new Map<string, "expanded" | "collapsed">());

  useEffect(() => {
    overridesRef.current = readTreeOverrides(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (ideas.length === 0) return;
    setCollapsedIds(computeCollapsedIds(ideas, overridesRef.current, searchQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRowCount, searchQuery]);

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
      writeTreeOverrides(storageKey, overridesRef.current);
      return next;
    });
  };

  const expandIdea = (id: string) => {
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      overridesRef.current.set(id, "expanded");
      writeTreeOverrides(storageKey, overridesRef.current);
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
    writeTreeOverrides(storageKey, overridesRef.current);
    setCollapsedIds(new Set());
  };

  const collapseAll = () => {
    overridesRef.current.clear();
    const parents = new Set(
      ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
    );
    for (const id of parents) {
      const depth = getDepthMap(ideas).get(id) ?? 0;
      if (depth < DEFAULT_EXPAND_DEPTH) {
        overridesRef.current.set(id, "collapsed");
      }
    }
    writeTreeOverrides(storageKey, overridesRef.current);
    setCollapsedIds(parents);
  };

  const tree = useMemo(() => buildIdeaTree(ideas, collapsedIds), [ideas, collapsedIds]);

  return { collapsedIds, tree, toggleCollapse, expandIdea, expandAll, collapseAll };
}
