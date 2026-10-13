"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TERMINAL_STATUSES } from "@/lib/constants";
import { getAncestorChain } from "@/lib/ideaTreeFocus";
import type { Idea } from "@/lib/types";

interface UseProjectsSelectionParams {
  ideas: Idea[];
  loading: boolean;
  expandIdea: (id: string) => void;
  setHideCompleted: (v: boolean) => void;
  setStatusFilter: (v: "all" | "open") => void;
}

/**
 * Project + focus selection with URL sync and the `?highlight=` deep-link.
 * Owns selectedId/focusedId plus the detail-local unpathed filter, which
 * resets on navigation together with focus.
 */
export function useProjectsSelection({
  ideas,
  loading,
  expandIdea,
  setHideCompleted,
  setStatusFilter,
}: UseProjectsSelectionParams) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialProjectId = searchParams.get("projectId");
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId);
  // Detail focus is local-only (subtree re-root); selectedId stays the project in URL.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [unpathedOnly, setUnpathedOnly] = useState(false);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    // Project navigation resets local focus + detail filters.
    setFocusedId(null);
    setUnpathedOnly(false);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("projectId", id);
    else params.delete("projectId");
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
    if (id) expandIdea(id);
  };

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid !== selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL to state
      setSelectedId(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle highlight deep-link: auto-select containing project and pulse highlight
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || loading) return;
    const idea = ideas.find((i) => i.id === highlightId);
    if (!idea) return;
    // Guarantee the highlight target stays visible in the project list.
    if ((TERMINAL_STATUSES as readonly string[]).includes(idea.status)) {
      setHideCompleted(false);
      setStatusFilter("all");
    }
    const byId = new Map(ideas.map((i) => [i.id, i]));
    let projectId: string | null = null;
    if (idea.type === "project") projectId = idea.id;
    else {
      let cur: Idea | undefined = idea;
      while (cur?.parent_id) {
        const parent = byId.get(cur.parent_id);
        if (!parent) break;
        if (parent.type === "project") {
          projectId = parent.id;
          break;
        }
        cur = parent;
      }
    }
    if (projectId) {
      if (projectId !== selectedId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- highlight deep-link selects containing project
        setSelectedId(projectId);
        expandIdea(projectId);
      }
      expandIdea(highlightId);
      // Expand all ancestors so highlighted node is visible
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
    if (projectId) params.set("projectId", projectId);
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  useEffect(() => {
    if (selectedId && !loading && !ideas.some((i) => i.id === selectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- self-heal deleted project
      handleSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas, loading]);

  // Ensure the selected project is expanded so its tasks render even when it
  // sits nested (default collapse depth would otherwise hide its children).
  useEffect(() => {
    if (selectedId && !loading) {
      expandIdea(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loading]);

  const breadcrumbChain = useMemo(
    () => (selectedId ? getAncestorChain(selectedId, ideas) : []),
    [selectedId, ideas],
  );

  return {
    selectedId,
    focusedId,
    setFocusedId,
    unpathedOnly,
    setUnpathedOnly,
    handleSelect,
    breadcrumbChain,
    focusRootId: focusedId ?? selectedId,
  };
}
