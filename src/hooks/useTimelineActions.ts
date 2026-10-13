"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { priorityRank } from "@/components/shared/PriorityChip";
import { isPast } from "@/lib/dateUtils";
import { getCompletionEffects, hasAnyEffects } from "@/lib/linkEffects";
import { computeReschedulePatch, type RescheduleAction } from "@/lib/tasks/rescheduleTask";
import type { Idea, LifeArea, LinkType } from "@/lib/types";
import type { useClassifications } from "@/hooks/useClassifications";
import type { useIdeaLinks } from "@/hooks/useIdeaLinks";
import type { useIdeas } from "@/hooks/useIdeas";
import type { useTags } from "@/hooks/useTags";
import type { useTaskTags } from "@/hooks/useTaskTags";
import type { useCompletionEffects } from "@/stores/feedbackStore";

type IdeasApi = Pick<
  ReturnType<typeof useIdeas>,
  "createIdea" | "markDone" | "updateIdea" | "moveIdea" | "reorderTasks"
>;

interface UseTimelineActionsParams {
  ideas: Idea[];
  ideasApi: IdeasApi;
  linksHook: ReturnType<typeof useIdeaLinks>;
  tagsHook: ReturnType<typeof useTags>;
  taskTagsHook: ReturnType<typeof useTaskTags>;
  getOptionForIdea: ReturnType<typeof useClassifications>["getOptionForIdea"];
  setCompletionEffects: ReturnType<typeof useCompletionEffects>["setCompletionEffects"];
}

/**
 * Timeline mutation + navigation callbacks. Callback-only, no effects.
 */
export function useTimelineActions({
  ideas,
  ideasApi,
  linksHook,
  tagsHook,
  taskTagsHook,
  getOptionForIdea,
  setCompletionEffects,
}: UseTimelineActionsParams) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createIdea, markDone, updateIdea, moveIdea, reorderTasks } = ideasApi;

  const priorityRankOf = useCallback(
    (ideaId: string) =>
      priorityRank(
        (getOptionForIdea(ideaId, "priority")?.value ?? null) as "high" | "medium" | "low" | null,
      ),
    [getOptionForIdea],
  );

  const handleQuickAdd = async (text: string, date: string, area: LifeArea | null) => {
    const past = isPast(date);
    const id = await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: date,
      status: past ? "completed" : "planned",
      ...(past ? { completed_at: new Date().toISOString() } : {}),
    });
    if (id && area) {
      const tag = await tagsHook.getOrCreateSystemTag(area);
      if (tag) await taskTagsHook.addTagToTask(id, tag);
    }
  };

  const handleReschedule = useCallback(
    async (id: string, action: RescheduleAction) => {
      const idea = ideas.find((i) => i.id === id);
      if (!idea) return;
      const patch = computeReschedulePatch(idea, action);
      await updateIdea(id, patch);
    },
    [ideas, updateIdea],
  );

  const handleDone = useCallback(
    async (id: string) => {
      const prev = ideas.find((i) => i.id === id);
      const effects = getCompletionEffects(id, ideas, linksHook.links);
      await markDone(id);
      if (prev && hasAnyEffects(effects))
        setCompletionEffects({ effects, completedText: prev.text });
    },
    [ideas, markDone, linksHook.links, setCompletionEffects],
  );

  const handleUpdate = useCallback(
    async (id: string, patch: Partial<Idea>) => {
      const prev = ideas.find((i) => i.id === id);
      if (patch.status === "completed" && prev && prev.status !== "completed") {
        const effects = getCompletionEffects(id, ideas, linksHook.links);
        await updateIdea(id, patch);
        if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
        return;
      }
      await updateIdea(id, patch);
    },
    [ideas, updateIdea, linksHook.links, setCompletionEffects],
  );

  const handleReorderDate = useCallback(
    (reordered: Idea[]) => {
      reorderTasks(reordered.map((t) => t.id));
    },
    [reorderTasks],
  );

  const setAnchorParam = useCallback(
    (d: string, taskId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", d);
      if (taskId) params.set("highlight", taskId);
      router.replace(`/timeline?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleAnchorChange = useCallback(
    (d: string) => {
      setAnchorParam(d);
    },
    [setAnchorParam],
  );

  const handleGoToDate = useCallback(
    (targetDate: string, taskId: string) => {
      setAnchorParam(targetDate, taskId);
    },
    [setAnchorParam],
  );

  const handleMove = useCallback(
    async (id: string, newParentId: string | null, newSortOrder: number) => {
      await moveIdea(id, newParentId, newSortOrder);
    },
    [moveIdea],
  );

  const handleCreateLink = useCallback(
    async (sourceId: string, targetId: string, linkType: LinkType) => {
      return linksHook.createLink(sourceId, targetId, linkType);
    },
    [linksHook],
  );

  const handleDeleteLink = useCallback(
    async (id: string) => {
      await linksHook.deleteLink(id);
    },
    [linksHook],
  );

  return {
    priorityRankOf,
    handleQuickAdd,
    handleReschedule,
    handleDone,
    handleUpdate,
    handleReorderDate,
    setAnchorParam,
    handleAnchorChange,
    handleGoToDate,
    handleMove,
    handleCreateLink,
    handleDeleteLink,
  };
}
