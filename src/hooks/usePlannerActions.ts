"use client";

import { useCallback } from "react";
import { computeReschedulePatch, type RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { getToday, isPast } from "@/lib/dateUtils";
import { minutesToTimeString } from "@/components/planner/dayslotAdapter";
import type { Idea, LifeArea, Tag } from "@/lib/types";
import type { useIdeas } from "@/hooks/useIdeas";
import type { useTags } from "@/hooks/useTags";
import type { useTaskTags } from "@/hooks/useTaskTags";
import type { useUndoAction } from "@/lib/tasks/undo";

type IdeasApi = Pick<
  ReturnType<typeof useIdeas>,
  "createIdea" | "updateIdea" | "deleteIdea" | "restoreIdeas" | "reorderTasks"
>;

interface UsePlannerActionsParams {
  ideas: Idea[];
  ideasApi: IdeasApi;
  activeDate: string;
  tagsHook: Pick<ReturnType<typeof useTags>, "tags" | "getOrCreateSystemTag">;
  taskTagsHook: Pick<ReturnType<typeof useTaskTags>, "addTagToTask" | "removeTagFromTask">;
  registerUndo: ReturnType<typeof useUndoAction>["registerUndo"];
  pendingByArea: Record<LifeArea, Idea[]>;
}

/**
 * Daily Planner mutation callbacks: area add/move, attach, dnd reorder,
 * schedule-from-drop, reschedule, and subtree delete with undo.
 * Callback-only, no effects.
 */
export function usePlannerActions({
  ideas,
  ideasApi,
  activeDate,
  tagsHook,
  taskTagsHook,
  registerUndo,
  pendingByArea,
}: UsePlannerActionsParams) {
  const { createIdea, updateIdea, deleteIdea, restoreIdeas, reorderTasks } = ideasApi;

  const handleAddToArea = async (text: string, area: LifeArea) => {
    const id = await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: activeDate,
      status: "planned",
      productivity_signal: null,
    });
    // Auto-tag with the system tag for this area (created on demand if missing)
    if (id) {
      const systemTag = await tagsHook.getOrCreateSystemTag(area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
  };

  const handleMoveTaskBetweenAreas = async (
    taskId: string,
    fromArea: LifeArea,
    toArea: LifeArea,
  ) => {
    const sourceTag = tagsHook.tags.find((t) => t.is_system && t.area === fromArea);
    if (sourceTag) await taskTagsHook.removeTagFromTask(taskId, sourceTag.id).catch(() => {});
    const targetTag = await tagsHook.getOrCreateSystemTag(toArea);
    if (targetTag) await taskTagsHook.addTagToTask(taskId, targetTag).catch(() => {});
  };

  const handleAttach = useCallback(
    async (taskId: string, parentId: string) => {
      await updateIdea(taskId, { parent_id: parentId });
    },
    [updateIdea],
  );

  const handleDndMoveBetweenAreas = async (
    taskId: string,
    fromArea: LifeArea,
    toArea: LifeArea,
    insertBeforeId: string | null,
  ) => {
    await handleMoveTaskBetweenAreas(taskId, fromArea, toArea);
    if (insertBeforeId) {
      const ids = pendingByArea[toArea].map((t) => t.id).filter((id) => id !== taskId);
      const idx = ids.indexOf(insertBeforeId);
      if (idx === -1) ids.push(taskId);
      else ids.splice(idx, 0, taskId);
      await reorderTasks(ids);
    }
  };

  const handleScheduleFromDrop = (taskId: string, startMinute: number) => {
    void updateIdea(taskId, {
      scheduled_time: minutesToTimeString(startMinute),
      status: "scheduled",
    });
  };

  const handleSortInArea = (_area: LifeArea, taskIds: string[]) => {
    void reorderTasks(taskIds);
  };

  const handleCreateScheduledTask = async (
    text: string,
    time: string,
    area?: LifeArea,
    tag?: Tag,
  ) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const past = isPast(activeDate) || (activeDate === getToday() && time <= currentTime);
    const id = await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: activeDate,
      scheduled_time: time,
      status: past ? "completed" : "scheduled",
      ...(past ? { completed_at: now.toISOString() } : {}),
      productivity_signal: null,
    });
    if (id && area) {
      const systemTag = await tagsHook.getOrCreateSystemTag(area);
      if (systemTag) await taskTagsHook.addTagToTask(id, systemTag);
    }
    if (id && tag && !tag.is_system) {
      await taskTagsHook.addTagToTask(id, tag);
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

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const collectSubtree = (rootId: string): Set<string> => {
        const ids = new Set<string>();
        const walk = (nodeId: string) => {
          ids.add(nodeId);
          ideas.filter((i) => i.parent_id === nodeId).forEach((child) => walk(child.id));
        };
        walk(rootId);
        return ids;
      };
      const deletedIds = collectSubtree(id);
      const deletedIdeas = ideas.filter((i) => deletedIds.has(i.id));
      await deleteIdea(id);
      if (deletedIdeas.length === 0) return;
      registerUndo({
        label: deletedIdeas.length > 1 ? "Tasks deleted" : "Task deleted",
        run: async () => {
          await restoreIdeas(deletedIdeas);
        },
      });
    },
    [ideas, deleteIdea, restoreIdeas, registerUndo],
  );

  return {
    handleAddToArea,
    handleMoveTaskBetweenAreas,
    handleAttach,
    handleDndMoveBetweenAreas,
    handleScheduleFromDrop,
    handleSortInArea,
    handleCreateScheduledTask,
    handleReschedule,
    handleDeleteTask,
  };
}
