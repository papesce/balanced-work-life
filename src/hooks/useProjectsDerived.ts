"use client";

import { useCallback, useMemo } from "react";
import { TERMINAL_STATUSES } from "@/lib/constants";
import type { Idea, IdeaNode } from "@/lib/types";
import { groupKeyOf, optionsForScheme } from "@/components/lens";
import { buildLensColumns, resolveLens } from "@/lib/horizonLenses";
import { priorityRank, type PriorityValue } from "@/components/shared/PriorityChip";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { useProjectLookups } from "@/stores/projectLookups";
import type { useClassifications } from "@/hooks/useClassifications";
import type { useTaskTags } from "@/hooks/useTaskTags";

type ClassificationsApi = Pick<
  ReturnType<typeof useClassifications>,
  "schemes" | "options" | "classifications"
>;

interface UseProjectsDerivedParams {
  ideas: Idea[];
  tree: IdeaNode[];
  taskTagsHook: ReturnType<typeof useTaskTags>;
  classifications: ClassificationsApi;
  lensKey: string;
  statusFilter: "all" | "open";
  hideCompleted: boolean;
  /** Path titles by idea id, for the unpathed-only filter. */
  membershipTitles: Map<string, string[]>;
  selectedId: string | null;
  focusRootId: string | null;
}

/**
 * Derived data for the projects page: list-board grouping/sorting plus the
 * detail TASKS grouping (top-level subtrees bucketed by scheme, intact).
 */
export function useProjectsDerived({
  ideas,
  tree,
  taskTagsHook,
  classifications,
  lensKey,
  statusFilter,
  hideCompleted,
  membershipTitles,
  selectedId,
  focusRootId,
}: UseProjectsDerivedParams) {
  const { schemes, options: classificationOptions } = classifications;
  const setPrefs = useUiPrefsStore((s) => s.set);
  const tasksGroupBy = useUiPrefsStore((s) => s.projectTasksGroupBy);

  const projects = useMemo(() => ideas.filter((i) => i.type === "project"), [ideas]);

  const { columns, valueOf, valuesBySchemeKey } = useProjectLookups(
    taskTagsHook,
    classifications,
    lensKey,
  );

  const priorityOf = useCallback(
    (ideaId: string): PriorityValue =>
      (valuesBySchemeKey.get("priority")?.get(ideaId) ?? null) as PriorityValue,
    [valuesBySchemeKey],
  );

  const visibleProjects = useMemo(() => {
    let list = projects;
    if (statusFilter === "open") {
      list = list.filter((p) => !(TERMINAL_STATUSES as readonly string[]).includes(p.status));
    }
    if (hideCompleted) {
      list = list.filter((p) => p.status !== "completed");
    }
    return [...list].sort((a, b) => {
      const rankDiff = priorityRank(priorityOf(a.id)) - priorityRank(priorityOf(b.id));
      if (rankDiff !== 0) return rankDiff;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [projects, statusFilter, hideCompleted, priorityOf]);

  const groupedProjects = useMemo(() => {
    const grouped = new Map<string | null, Idea[]>();
    for (const p of visibleProjects) {
      const key = valueOf(p.id);
      const list = grouped.get(key) ?? [];
      list.push(p);
      grouped.set(key, list);
    }
    return grouped;
  }, [visibleProjects, valueOf]);

  const handleLensChange = (key: string) => {
    if (key === lensKey) return;
    setPrefs({ projectsLens: key });
  };

  const lensTabs = useMemo(() => {
    const tabs: { key: string; label: string }[] = schemes
      .filter((s) => ["term", "nnl", "moscow", "priority", "attention"].includes(s.key))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ key: s.key, label: s.key === "term" ? "Horizon" : s.label }));
    return [...tabs, { key: "area", label: "Area" }];
  }, [schemes]);

  const selectedProject = useMemo(
    () => (selectedId ? (ideas.find((i) => i.id === selectedId) ?? null) : null),
    [ideas, selectedId],
  );

  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    const children = new Map<string, Idea[]>();
    for (const idea of ideas) {
      if (!idea.parent_id) continue;
      const group = children.get(idea.parent_id) ?? [];
      group.push(idea);
      children.set(idea.parent_id, group);
    }
    const result: Idea[] = [];
    const stack = [...(children.get(selectedProject.id) ?? [])];
    while (stack.length) {
      const task = stack.pop()!;
      result.push(task);
      stack.push(...(children.get(task.id) ?? []));
    }
    return result;
  }, [ideas, selectedProject]);

  const pathedIds = useMemo(() => new Set(membershipTitles.keys()), [membershipTitles]);
  const unpathedCount = useMemo(
    () => projectTasks.filter((t) => !pathedIds.has(t.id)).length,
    [projectTasks, pathedIds],
  );

  const detailLens = useMemo(() => {
    if (!tasksGroupBy) return null;
    const infos = schemes.map((s) => ({
      key: s.key,
      label: s.label,
      options: optionsForScheme(classificationOptions, s.id).map((o) => o.value),
    }));
    const { lens } = resolveLens(tasksGroupBy, infos);
    const scheme =
      schemes.find((s) => s.key === lens.primaryScheme) ??
      schemes.find((s) => s.key === tasksGroupBy) ??
      null;
    if (!scheme) return null;
    const columns = buildLensColumns(lens, optionsForScheme(classificationOptions, scheme.id));
    const inner = valuesBySchemeKey.get(scheme.key);
    return { scheme, columns, valueOf: (id: string) => inner?.get(id) ?? null };
  }, [tasksGroupBy, schemes, classificationOptions, valuesBySchemeKey]);

  const focusForest: IdeaNode[] = useMemo(() => {
    if (!focusRootId) return [];
    const findNode = (nodes: IdeaNode[]): IdeaNode | null => {
      for (const n of nodes) {
        if (n.id === focusRootId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
      return null;
    };
    return findNode(tree)?.children ?? [];
  }, [tree, focusRootId]);

  const groupedForest = useMemo(() => {
    if (!detailLens) return null;
    const grouped = new Map<string, IdeaNode[]>();
    for (const node of focusForest) {
      const key = groupKeyOf(detailLens.valueOf(node.id));
      const list = grouped.get(key) ?? [];
      list.push(node);
      grouped.set(key, list);
    }
    return grouped;
  }, [detailLens, focusForest]);

  return {
    projects,
    columns,
    valueOf,
    valuesBySchemeKey,
    priorityOf,
    visibleProjects,
    groupedProjects,
    handleLensChange,
    lensTabs,
    selectedProject,
    projectTasks,
    pathedIds,
    unpathedCount,
    detailLens,
    focusForest,
    groupedForest,
  };
}
