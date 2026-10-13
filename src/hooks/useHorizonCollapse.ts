"use client";

import { useMemo, useState } from "react";
import { STORAGE_KEYS, readTreeOverrides, writeTreeOverrides } from "@/lib/storage";
import type { Idea } from "@/lib/types";

/**
 * Horizon tree collapse state: everything collapsed by default, with
 * persisted per-node overrides. No effects; persistence writes on toggle.
 */
export function useHorizonCollapse(ideas: Idea[]) {
  const [overrides, setOverrides] = useState(() =>
    readTreeOverrides(STORAGE_KEYS.horizonTreeOverrides),
  );

  const collapsedIds = useMemo(() => {
    const parentIds = new Set(
      ideas.filter((i) => ideas.some((c) => c.parent_id === i.id)).map((i) => i.id),
    );
    const collapsed = new Set<string>();

    for (const id of parentIds) {
      const override = overrides.get(id);
      if (override === "expanded") continue;
      collapsed.add(id);
    }
    return collapsed;
  }, [ideas, overrides]);

  const onToggleCollapse = (id: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const isCurrentlyCollapsed = prev.get(id) === "collapsed" || !prev.has(id);
      next.set(id, isCurrentlyCollapsed ? "expanded" : "collapsed");
      writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
      return next;
    });
  };

  const onExpandIdea = (id: string) => {
    setOverrides((prev) => {
      if (!prev.has(id) || prev.get(id) === "expanded") return prev;
      const next = new Map(prev);
      next.set(id, "expanded");
      writeTreeOverrides(STORAGE_KEYS.horizonTreeOverrides, next);
      return next;
    });
  };

  return { overrides, setOverrides, collapsedIds, onToggleCollapse, onExpandIdea };
}
