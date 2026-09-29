"use client";

import { useState } from "react";
import { Idea, IdeaType, LinkType } from "@/lib/types";
import { getCompletionEffects, hasAnyEffects, CompletionEffects } from "@/lib/linkEffects";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { useUndoAction } from "@/lib/tasks/undo";
import { useIdeas, type CreateIdeaPosition } from "./useIdeas";
import { useIdeaLinks } from "./useIdeaLinks";

type IdeasApi = ReturnType<typeof useIdeas>;
type LinksApi = ReturnType<typeof useIdeaLinks>;

/** Single place to register an undoable mutation (replaces ~8 hand-rolled literals). */
export function withUndo(
  registerUndo: (action: { label: string; run: () => Promise<void> }) => void,
  label: string,
  run: () => Promise<void>,
) {
  registerUndo({ label, run });
}

/** Build a `{...prev picked keys}` restore object (replaces the per-caller key loop). */
export function restoreOf<T extends object>(prev: T, updates: Partial<T>): Partial<T> {
  const restore: Partial<T> = {};
  for (const k of Object.keys(updates) as Array<keyof T>) restore[k] = prev[k] as never;
  return restore;
}

const NEXT_STATUSES: ReadonlySet<string> = new Set(["draft", "planned", "in_progress"]);

export interface ProjectStat {
  done: number;
  total: number;
  direct: number;
  nextId: string | null;
}

export interface ProjectTree {
  stats: Map<string, ProjectStat>;
  childrenById: Map<string, Idea[]>;
}

/**
 * One O(N) post-order pass over all ideas producing per-node subtree stats
 * (done/total/next-action) plus a sorted children map. Memoize on `ideas`.
 * (ideaTreeFilters.ts has no memo pattern — it rebuilds Maps per call —
 * so this lives here instead of following a non-existent convention.)
 */
export function buildProjectTree(ideas: Idea[]): ProjectTree {
  const childrenById = new Map<string, Idea[]>();
  for (const idea of ideas) {
    if (!idea.parent_id) continue;
    const list = childrenById.get(idea.parent_id) ?? [];
    list.push(idea);
    childrenById.set(idea.parent_id, list);
  }
  for (const list of childrenById.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  const stats = new Map<string, ProjectStat>();
  const visiting = new Set<string>();

  const visit = (
    id: string,
  ): { done: number; total: number; nextId: string | null; nextOrder: number } => {
    const cached = stats.get(id);
    if (cached)
      return { done: cached.done, total: cached.total, nextId: cached.nextId, nextOrder: -1 };
    if (visiting.has(id)) return { done: 0, total: 0, nextId: null, nextOrder: Infinity };
    visiting.add(id);
    const kids = childrenById.get(id) ?? [];
    let done = 0;
    let total = 0;
    let nextId: string | null = null;
    let nextOrder = Infinity;
    for (const kid of kids) {
      total += 1;
      if (kid.status === "completed") done += 1;
      if (NEXT_STATUSES.has(kid.status) && kid.sort_order < nextOrder) {
        nextOrder = kid.sort_order;
        nextId = kid.id;
      }
      const sub = visit(kid.id);
      done += sub.done;
      total += sub.total;
      if (sub.nextId && sub.nextOrder >= 0 && sub.nextOrder < nextOrder) {
        nextOrder = sub.nextOrder;
        nextId = sub.nextId;
      }
    }
    visiting.delete(id);
    stats.set(id, { done, total, direct: kids.length, nextId });
    return { done, total, nextId, nextOrder };
  };

  for (const idea of ideas) visit(idea.id);
  return { stats, childrenById };
}

interface UseProjectActionsOptions {
  ideasHook: IdeasApi;
  linksHook: LinksApi;
  /** Called with the deleted subtree ids so the page can clear selection. */
  onDeleteIds?: (deletedIds: Set<string>) => void;
}

/**
 * All project mutations (create/rename/add-task/update/delete/move/link/
 * done/undone/schedule) with undo + completion effects in one place.
 * UI-level "new editable row" state (expand/select/editing) stays in the page
 * via its single `spawnEditable` helper.
 */
export function useProjectActions({ ideasHook, linksHook, onDeleteIds }: UseProjectActionsOptions) {
  const { undoAction, registerUndo, clearUndo, handleUndo } = useUndoAction();
  const [completionEffects, setCompletionEffects] = useState<{
    effects: CompletionEffects;
    completedText: string;
  } | null>(null);

  const createIdea = async (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ): Promise<string> => {
    const id = await ideasHook.createIdea(text, parentId, position, initialUpdates);
    if (id) withUndo(registerUndo, "Idea created", () => ideasHook.deleteIdea(id));
    return id;
  };

  const updateIdea = async (id: string, updates: Partial<Idea>) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    if (updates.status === "completed" && prev && prev.status !== "completed") {
      const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
      await ideasHook.updateIdea(id, updates);
      withUndo(registerUndo, "Idea updated", () =>
        ideasHook.updateIdea(id, restoreOf(prev, updates)),
      );
      if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
      return;
    }
    await ideasHook.updateIdea(id, updates);
    if (!prev) return;
    withUndo(registerUndo, "Idea updated", () =>
      ideasHook.updateIdea(id, restoreOf(prev, updates)),
    );
  };

  const deleteIdea = async (id: string) => {
    const deletedIds = getFocusedSubtreeIds(id, ideasHook.ideas);
    const deletedIdeas = ideasHook.ideas.filter((i) => deletedIds.has(i.id));
    const deletedLinks = linksHook.removeLinksForIdeaIds(deletedIds);
    await ideasHook.deleteIdea(id);
    if (deletedIdeas.length > 0) {
      withUndo(
        registerUndo,
        deletedIdeas.length > 1 ? "Ideas deleted" : "Idea deleted",
        async () => {
          await ideasHook.restoreIdeas(deletedIdeas);
          await linksHook.restoreLinks(deletedLinks);
        },
      );
    }
    onDeleteIds?.(deletedIds);
  };

  const moveIdea = async (id: string, newParentId: string | null, newSortOrder: number) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.moveIdea(id, newParentId, newSortOrder);
    if (!prev) return;
    withUndo(registerUndo, "Idea moved", () =>
      ideasHook.moveIdea(id, prev.parent_id, prev.sort_order),
    );
  };

  const createParentAndMove = async (
    id: string,
    text: string,
    type: IdeaType,
  ): Promise<string | null> => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    const parentId = await ideasHook.createParentAndMove(id, text, type);
    if (!parentId) return null;
    if (prev) {
      withUndo(registerUndo, "Parent created", async () => {
        await ideasHook.moveIdea(id, prev.parent_id, prev.sort_order);
        await ideasHook.deleteIdea(parentId);
      });
    }
    return parentId;
  };

  const createLink = async (s: string, t: string, type: LinkType): Promise<string> => {
    const id = await linksHook.createLink(s, t, type);
    if (id) withUndo(registerUndo, "Link created", () => linksHook.deleteLink(id));
    return id;
  };

  const deleteLink = async (id: string) => {
    const del = linksHook.links.find((l) => l.id === id);
    await linksHook.deleteLink(id);
    if (!del) return;
    withUndo(registerUndo, "Link deleted", () => linksHook.restoreLinks([del]));
  };

  const markDone = async (id: string) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    const effects = getCompletionEffects(id, ideasHook.ideas, linksHook.links);
    await ideasHook.markDone(id);
    if (!prev) return;
    withUndo(registerUndo, "Idea completed", () =>
      ideasHook.updateIdea(id, { status: prev.status, completed_at: prev.completed_at }),
    );
    if (hasAnyEffects(effects)) setCompletionEffects({ effects, completedText: prev.text });
  };

  const markUndone = async (id: string) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.markUndone(id);
    if (!prev) return;
    withUndo(registerUndo, "Idea reopened", () =>
      ideasHook.updateIdea(id, { status: prev.status, completed_at: prev.completed_at }),
    );
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const prev = ideasHook.ideas.find((i) => i.id === id);
    await ideasHook.scheduleIdea(id, date);
    if (!prev) return;
    withUndo(registerUndo, date ? "Idea scheduled" : "Schedule cleared", () =>
      ideasHook.updateIdea(id, {
        scheduled_date: prev.scheduled_date,
        attempt_dates: prev.attempt_dates,
      }),
    );
  };

  /** Single rename path for card titles, detail header, and tree rows. */
  const commitRename = async (id: string, text: string) => {
    const trimmed = text.trim();
    if (trimmed) await updateIdea(id, { text: trimmed });
  };

  /** Single add-task path (detail header, card menu, expanded preview all call this). */
  const addTask = (parentId: string) =>
    createIdea("", parentId, "bottom", { type: "task", status: "draft" });

  /** Single add-project path (header button + per-group button share this). */
  const addProject = () => createIdea("", null, "bottom", { type: "project", status: "planned" });

  return {
    undoAction,
    clearUndo,
    handleUndo,
    registerUndo,
    completionEffects,
    setCompletionEffects,
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
    commitRename,
    addTask,
    addProject,
  };
}

export type { CreateIdeaPosition };
