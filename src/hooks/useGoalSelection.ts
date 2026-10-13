"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { getAncestorChain } from "@/lib/ideaTreeFocus";
import type { Idea } from "@/lib/types";

interface UseGoalSelectionParams {
  ideas: Idea[];
  loading: boolean;
  expandIdea: (id: string) => void;
  statusFilter: "all" | "open";
  hideCompleted: boolean;
  setHideCompleted: (v: boolean) => void;
  setStatusFilter: (v: "all" | "open") => void;
}

/**
 * Goal selection with URL sync, `?highlight=` deep-link, self-heal and the
 * list/detail derived data. Filter state stays in the page (list UI).
 */
export function useGoalSelection({
  ideas,
  loading,
  expandIdea,
  statusFilter,
  hideCompleted,
  setHideCompleted,
  setStatusFilter,
}: UseGoalSelectionParams) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialGoalId = searchParams.get("goalId");
  const [selectedId, setSelectedId] = useState<string | null>(initialGoalId);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("goalId", id);
    else params.delete("goalId");
    const qs = params.toString();
    router.replace(qs ? `/goals?${qs}` : "/goals", { scroll: false });
    if (id) expandIdea(id);
  };

  useEffect(() => {
    const pid = searchParams.get("goalId");
    if (pid !== selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL to state
      setSelectedId(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle highlight deep-link: auto-select containing goal and pulse highlight
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || loading) return;
    const idea = ideas.find((i) => i.id === highlightId);
    if (!idea) return;
    // Guarantee the highlight target stays visible in the goal list.
    if ((TERMINAL_STATUSES as readonly string[]).includes(idea.status)) {
      setHideCompleted(false);
      setStatusFilter("all");
    }
    const byId = new Map(ideas.map((i) => [i.id, i]));
    let goalId: string | null = null;
    if (idea.type === "objective") goalId = idea.id;
    else {
      let cur: Idea | undefined = idea;
      while (cur?.parent_id) {
        const parent = byId.get(cur.parent_id);
        if (!parent) break;
        if (parent.type === "objective") {
          goalId = parent.id;
          break;
        }
        cur = parent;
      }
    }
    if (goalId) {
      if (goalId !== selectedId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link selects containing goal
        setSelectedId(goalId);
        expandIdea(goalId);
      }
      expandIdea(highlightId);
      const chain = getAncestorChain(highlightId, ideas);
      for (const anc of chain) expandIdea(anc.id);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`idea-${highlightId}`);
        if (el) {
          el.classList.add("highlight-pulse");
          setTimeout(() => el.classList.remove("highlight-pulse"), 1600);
        }
      });
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("highlight");
    if (goalId) params.set("goalId", goalId);
    const qs = params.toString();
    router.replace(qs ? `/goals?${qs}` : "/goals", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  useEffect(() => {
    if (selectedId && !loading && !ideas.some((i) => i.id === selectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heal deleted goal
      handleSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas, loading]);

  // Ensure the selected goal is expanded so its tasks render even when it
  // sits nested (default collapse depth would otherwise hide its children).
  useEffect(() => {
    if (selectedId && !loading) {
      expandIdea(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loading]);

  const goals = useMemo(() => ideas.filter((i) => i.type === "objective"), [ideas]);

  const visibleGoals = useMemo(() => {
    let list = goals;
    if (statusFilter === "open") {
      list = list.filter((p) => !(TERMINAL_STATUSES as readonly string[]).includes(p.status));
    }
    if (hideCompleted) {
      list = list.filter((p) => p.status !== "completed");
    }
    return [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [goals, statusFilter, hideCompleted]);

  const selectedGoal = useMemo(
    () => (selectedId ? (ideas.find((i) => i.id === selectedId) ?? null) : null),
    [ideas, selectedId],
  );

  const breadcrumbChain = useMemo(
    () => (selectedId ? getAncestorChain(selectedId, ideas) : []),
    [selectedId, ideas],
  );

  return {
    selectedId,
    handleSelect,
    goals,
    visibleGoals,
    selectedGoal,
    breadcrumbChain,
  };
}
