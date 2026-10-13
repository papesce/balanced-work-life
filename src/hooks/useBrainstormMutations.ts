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

interface UseBrainstormMutationsParams {
  ideasApi: IdeasApi;
  linksApi: LinksApi;
  registerUndo: ReturnType<typeof useUndoAction>["registerUndo"];
  setCompletionEffects: ReturnType<typeof useCompletionEffects>["setCompletionEffects"];
}

/**
 * Brainstorm idea/link mutations with undo + completion effects.
 * Callback-only, no effects.
 */
export function useBrainstormMutations({
  ideasApi,
  linksApi,
  registerUndo,
  setCompletionEffects,
}: UseBrainstormMutationsParams) {
  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
  ): Promise<string> => {
    const id = await ideasApi.createIdea(text, parentId, position);
    if (id) {
      registerUndo({
        label: "Idea created",
        run: async () => {
          await ideasApi.deleteIdea(id);
        },
      });
    }
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    if (updates.status === "completed" && previous && previous.status !== "completed") {
      const effects = getCompletionEffects(id, ideasApi.ideas, linksApi.links);
      await ideasApi.updateIdea(id, updates);
      const restore: Partial<Idea> = {};
      for (const key of Object.keys(updates) as Array<keyof Idea>) {
        restore[key] = previous[key] as never;
      }
      registerUndo({
        label: "Idea updated",
        run: async () => {
          await ideasApi.updateIdea(id, restore);
        },
      });
      if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: previous.text });
      return;
    }
    await ideasApi.updateIdea(id, updates);
    if (!previous) return;

    const restore: Partial<Idea> = {};
    for (const key of Object.keys(updates) as Array<keyof Idea>) {
      restore[key] = previous[key] as never;
    }
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
  };

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    await ideasApi.moveIdea(id, newParentId, newSortOrder);
    if (!previous) return;

    registerUndo({
      label: "Idea moved",
      run: async () => {
        await ideasApi.moveIdea(id, previous.parent_id, previous.sort_order);
      },
    });
  };

  const createParentAndMove = async (
    id: string,
    text: string,
    type: IdeaType,
  ): Promise<string | null> => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    const parentId = await ideasApi.createParentAndMove(id, text, type);
    if (!parentId) return null;
    if (previous) {
      registerUndo({
        label: "Parent created",
        run: async () => {
          await ideasApi.moveIdea(id, previous.parent_id, previous.sort_order);
          await ideasApi.deleteIdea(parentId);
        },
      });
    }
    return parentId;
  };

  const createLink = async (
    sourceId: string,
    targetId: string,
    linkType: LinkType,
  ): Promise<string> => {
    const id = await linksApi.createLink(sourceId, targetId, linkType);
    if (id) {
      registerUndo({
        label: "Link created",
        run: async () => {
          await linksApi.deleteLink(id);
        },
      });
    }
    return id;
  };

  const deleteLink = async (id: string) => {
    const deletedLink = linksApi.links.find((link) => link.id === id);
    await linksApi.deleteLink(id);
    if (!deletedLink) return;

    registerUndo({
      label: "Link deleted",
      run: async () => {
        await linksApi.restoreLinks([deletedLink]);
      },
    });
  };

  const markDone = async (id: string) => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    // Compute effects BEFORE status flips to completed (uses current statuses)
    const effects = getCompletionEffects(id, ideasApi.ideas, linksApi.links);
    await ideasApi.markDone(id);
    if (!previous) return;

    registerUndo({
      label: "Idea completed",
      run: async () => {
        await ideasApi.updateIdea(id, {
          status: previous.status,
          completed_at: previous.completed_at,
        });
      },
    });
    if (hasAnyEffects(effects)) {
      setCompletionEffects({ effects, completedText: previous.text });
    }
  };

  const markUndone = async (id: string) => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    await ideasApi.markUndone(id);
    if (!previous) return;

    registerUndo({
      label: "Idea reopened",
      run: async () => {
        await ideasApi.updateIdea(id, {
          status: previous.status,
          completed_at: previous.completed_at,
        });
      },
    });
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const previous = ideasApi.ideas.find((idea) => idea.id === id);
    await ideasApi.scheduleIdea(id, date);
    if (!previous) return;

    registerUndo({
      label: date ? "Idea scheduled" : "Schedule cleared",
      run: async () => {
        await ideasApi.updateIdea(id, {
          scheduled_date: previous.scheduled_date,
          attempt_dates: previous.attempt_dates,
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
