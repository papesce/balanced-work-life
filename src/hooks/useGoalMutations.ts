"use client";

import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { getCompletionEffects, hasAnyEffects } from "@/lib/linkEffects";
import type { Idea, IdeaType, LinkType } from "@/lib/types";
import type { CreateIdeaPosition } from "@/hooks/useIdeas";
import type { useIdeaLinks } from "@/hooks/useIdeaLinks";
import type { useIdeas } from "@/hooks/useIdeas";
import type { useUndoAction } from "@/lib/tasks/undo";
import type { useCompletionEffects } from "@/stores/feedbackStore";

type IdeasApi = Pick<
  ReturnType<typeof useIdeas>,
  | "ideas"
  | "createIdea"
  | "updateIdea"
  | "deleteIdea"
  | "moveIdea"
  | "createParentAndMove"
  | "markDone"
  | "markUndone"
  | "scheduleIdea"
  | "restoreIdeas"
>;
type LinksApi = Pick<
  ReturnType<typeof useIdeaLinks>,
  "links" | "createLink" | "deleteLink" | "removeLinksForIdeaIds" | "restoreLinks"
>;

interface UseGoalMutationsParams {
  ideasApi: IdeasApi;
  linksApi: LinksApi;
  registerUndo: ReturnType<typeof useUndoAction>["registerUndo"];
  setCompletionEffects: ReturnType<typeof useCompletionEffects>["setCompletionEffects"];
  /** Called with deleted subtree ids so the page can clear a deleted selection. */
  onDeleteIds?: (deletedIds: Set<string>) => void;
}

/**
 * Goals idea/link mutations with undo + completion effects.
 * Callback-only, no effects.
 */
export function useGoalMutations({
  ideasApi,
  linksApi,
  registerUndo,
  setCompletionEffects,
  onDeleteIds,
}: UseGoalMutationsParams) {
  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ): Promise<string> => {
    const id = await ideasApi.createIdea(text, parentId, position, initialUpdates);
    if (id)
      registerUndo({
        label: "Idea created",
        run: async () => {
          await ideasApi.deleteIdea(id);
        },
      });
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    if (updates.status === "completed" && prev && prev.status !== "completed") {
      const effects = getCompletionEffects(id, ideasApi.ideas, linksApi.links);
      await ideasApi.updateIdea(id, updates);
      const restore: Partial<Idea> = {};
      for (const k of Object.keys(updates) as Array<keyof Idea>) restore[k] = prev[k] as never;
      registerUndo({
        label: "Idea updated",
        run: async () => {
          await ideasApi.updateIdea(id, restore);
        },
      });
      if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
      return;
    }
    await ideasApi.updateIdea(id, updates);
    if (!prev) return;
    const restore: Partial<Idea> = {};
    for (const k of Object.keys(updates) as Array<keyof Idea>) restore[k] = prev[k] as never;
    registerUndo({
      label: "Idea updated",
      run: async () => {
        await ideasApi.updateIdea(id, restore);
      },
    });
  };

  const deleteIdea = async (id: string) => {
    const deletedIds = getFocusedSubtreeIds(id, ideasApi.ideas);
    const deletedIdeas = ideasApi.ideas.filter((idea) => deletedIds.has(idea.id));
    const deletedLinks = linksApi.removeLinksForIdeaIds(deletedIds);
    await ideasApi.deleteIdea(id);
    if (deletedIdeas.length === 0) return;
    registerUndo({
      label: deletedIdeas.length > 1 ? "Ideas deleted" : "Idea deleted",
      run: async () => {
        await ideasApi.restoreIdeas(deletedIdeas);
        await linksApi.restoreLinks(deletedLinks);
      },
    });
    onDeleteIds?.(deletedIds);
  };

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    await ideasApi.moveIdea(id, newParentId, newSortOrder);
    if (!prev) return;
    registerUndo({
      label: "Idea moved",
      run: async () => {
        await ideasApi.moveIdea(id, prev.parent_id, prev.sort_order);
      },
    });
  };

  const createParentAndMove = async (
    id: string,
    text: string,
    type: IdeaType,
  ): Promise<string | null> => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    const parentId = await ideasApi.createParentAndMove(id, text, type);
    if (!parentId) return null;
    if (prev) {
      registerUndo({
        label: "Parent created",
        run: async () => {
          await ideasApi.moveIdea(id, prev.parent_id, prev.sort_order);
          await ideasApi.deleteIdea(parentId);
        },
      });
    }
    return parentId;
  };

  const createLink = async (s: string, t: string, type: LinkType): Promise<string> => {
    const id = await linksApi.createLink(s, t, type);
    if (id)
      registerUndo({
        label: "Link created",
        run: async () => {
          await linksApi.deleteLink(id);
        },
      });
    return id;
  };

  const deleteLink = async (id: string) => {
    const del = linksApi.links.find((l) => l.id === id);
    await linksApi.deleteLink(id);
    if (!del) return;
    registerUndo({
      label: "Link deleted",
      run: async () => {
        await linksApi.restoreLinks([del]);
      },
    });
  };

  const markDone = async (id: string) => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    const effects = getCompletionEffects(id, ideasApi.ideas, linksApi.links);
    await ideasApi.markDone(id);
    if (!prev) return;
    registerUndo({
      label: "Idea completed",
      run: async () => {
        await ideasApi.updateIdea(id, { status: prev.status, completed_at: prev.completed_at });
      },
    });
    if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
  };

  const markUndone = async (id: string) => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    await ideasApi.markUndone(id);
    if (!prev) return;
    registerUndo({
      label: "Idea reopened",
      run: async () => {
        await ideasApi.updateIdea(id, { status: prev.status, completed_at: prev.completed_at });
      },
    });
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const prev = ideasApi.ideas.find((i) => i.id === id);
    await ideasApi.scheduleIdea(id, date);
    if (!prev) return;
    registerUndo({
      label: date ? "Idea scheduled" : "Schedule cleared",
      run: async () => {
        await ideasApi.updateIdea(id, {
          scheduled_date: prev.scheduled_date,
          attempt_dates: prev.attempt_dates,
        });
      },
    });
  };

  return {
    createIdea,
    updateIdea,
    deleteIdea,
    moveIdea,
    createParentAndMove,
    createLink,
    deleteLink,
    markDone,
    markUndone,
    scheduleIdea,
  };
}
