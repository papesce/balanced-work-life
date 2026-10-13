"use client";

import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import type { Idea, IdeaType } from "@/lib/types";
import type { CreateIdeaPosition } from "@/hooks/useIdeas";
import type { useIdeas } from "@/hooks/useIdeas";
import type { useIdeaLinks } from "@/hooks/useIdeaLinks";
import type { useUndoAction } from "@/lib/tasks/undo";

type IdeasApi = Pick<
  ReturnType<typeof useIdeas>,
  "ideas" | "updateIdea" | "deleteIdea" | "createIdea" | "restoreIdeas"
>;
type LinksApi = Pick<ReturnType<typeof useIdeaLinks>, "removeLinksForIdeaIds" | "restoreLinks">;

interface UseHorizonMutationsParams {
  ideasHook: IdeasApi;
  linksHook: LinksApi;
  setClassification: (ideaId: string, schemeKey: string, value: string | null) => Promise<void>;
  registerUndo: ReturnType<typeof useUndoAction>["registerUndo"];
  lensKey: string;
  activeSchemeLabel: string;
  valueOf: (ideaId: string) => string | null;
  priorityOf: (ideaId: string) => string | null;
  secondaryLabelOf: (secondaryKey: string) => string;
  secondaryValueOfId: (secondaryKey: string, ideaId: string) => string | null;
}

/**
 * Horizon idea mutations with undo support: update/delete/create plus
 * classification setters (primary/priority/secondary) and pre-tagged add.
 */
export function useHorizonMutations({
  ideasHook,
  linksHook,
  setClassification,
  registerUndo,
  lensKey,
  activeSchemeLabel,
  valueOf,
  priorityOf,
  secondaryLabelOf,
  secondaryValueOfId,
}: UseHorizonMutationsParams) {
  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const previous = ideasHook.ideas.find((idea) => idea.id === id);
    await ideasHook.updateIdea(id, updates);
    if (!previous) return;
    const restore: Partial<Idea> = {};
    for (const key of Object.keys(updates) as Array<keyof Idea>) {
      restore[key] = previous[key] as never;
    }
    registerUndo({
      label: "Idea updated",
      run: async () => {
        await ideasHook.updateIdea(id, restore);
      },
    });
  };

  const deleteIdea = async (id: string) => {
    const deletedIds = getFocusedSubtreeIds(id, ideasHook.ideas);
    const deletedIdeas = ideasHook.ideas.filter((idea) => deletedIds.has(idea.id));
    const deletedLinks = linksHook.removeLinksForIdeaIds(deletedIds);
    await ideasHook.deleteIdea(id);
    if (deletedIdeas.length === 0) return;
    registerUndo({
      label: deletedIdeas.length > 1 ? "Ideas deleted" : "Idea deleted",
      run: async () => {
        await ideasHook.restoreIdeas(deletedIdeas);
        await linksHook.restoreLinks(deletedLinks);
      },
    });
  };

  const createIdea = async (
    text: string,
    parentId: string | null,
    position: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ): Promise<string> => {
    const id = await ideasHook.createIdea(text, parentId, position, initialUpdates);
    if (id) {
      registerUndo({
        label: "Idea created",
        run: async () => {
          await ideasHook.deleteIdea(id);
        },
      });
    }
    return id;
  };

  /** Set a classification with undo support (shared by primary/priority/secondary). */
  const handleSetClassification = async (
    schemeKey: string,
    id: string,
    value: string | null,
    previous: string | null,
    label: string,
  ) => {
    await setClassification(id, schemeKey, value);
    registerUndo({
      label: `${label} updated`,
      run: async () => {
        await setClassification(id, schemeKey, previous);
      },
    });
  };

  const handleSetValue = (id: string, value: string | null) =>
    handleSetClassification(lensKey, id, value, valueOf(id), activeSchemeLabel);

  const handleSetPriority = (id: string, value: string | null) =>
    handleSetClassification("priority", id, value, priorityOf(id), "Priority");

  const handleSetSecondary = (secondaryKey: string, id: string, value: string | null) =>
    handleSetClassification(
      secondaryKey,
      id,
      value,
      secondaryValueOfId(secondaryKey, id),
      secondaryLabelOf(secondaryKey),
    );

  const handleAdd = (value: string | null, secondaryKey: string | null = null) => {
    return async (text: string, type?: IdeaType, secondaryValue?: string | null): Promise<void> => {
      const id = await createIdea(text, null, "bottom", {
        type: type ?? "task",
        status: "draft",
      });
      if (id && value) {
        await setClassification(id, lensKey, value);
      }
      if (id && secondaryKey && secondaryValue) {
        await setClassification(id, secondaryKey, secondaryValue);
      }
    };
  };

  return {
    updateIdea,
    deleteIdea,
    createIdea,
    handleSetClassification,
    handleSetValue,
    handleSetPriority,
    handleSetSecondary,
    handleAdd,
  };
}
