"use client";

import { useState, useEffect } from "react";
import { UndoAction } from "@/lib/tasks/undo";
import { areaColors } from "@/styles/tokens";
import { Idea, LifeArea, Tag } from "@/lib/types";
import { AREA_ICONS, AREA_LABELS } from "@/lib/constants";
import { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { PendingTaskList } from "./PendingTaskList";

interface AreaTaskGroupProps {
  area: LifeArea;
  activeDate: string;
  pendingTasks: Idea[];
  doneTasks: Idea[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onDelete: (id: string) => void;
  onAddTask: (text: string, area: LifeArea) => Promise<void>;
  onReorderTasks: (taskIds: string[]) => void;
  onMoveTaskBetweenAreas?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  getTagsForIdea?: (ideaId: string) => Tag[];
  allTags?: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onUndoAction?: (action: UndoAction) => void;
}

export function AreaTaskGroup({
  area,
  activeDate,
  pendingTasks,
  doneTasks,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onDelete,
  onAddTask,
  onReorderTasks,
  onMoveTaskBetweenAreas,
  getTagsForIdea,
  allTags,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  onUndoAction,
}: AreaTaskGroupProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [areaInputValue, setAreaInputValue] = useState("");
  const Icon = AREA_ICONS[area];
  const color = areaColors[area]?.dot;

  useEffect(() => {
    const clear = () => setIsDragOver(false);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);

  return (
    <div
      className={`glass-card rounded-2xl border border-black/5 transition-all duration-200 dark:border-white/5 ${
        isDragOver ? "scale-[1.005] bg-violet-500/[0.03] ring-2 ring-violet-500/50" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        const sourceArea = e.dataTransfer.getData("text/lifearea") as LifeArea | "";
        if (taskId && sourceArea && sourceArea !== area) {
          onMoveTaskBetweenAreas?.(taskId, sourceArea, area);
        } else if (taskId) {
          void onReschedule(taskId, { type: "reschedule", newDate: activeDate });
        }
      }}
    >
      <div
        className="flex items-center gap-2 rounded-t-2xl border-b border-black/5 bg-black/[0.01] px-4 py-3 dark:border-white/5 dark:bg-white/[0.01]"
        style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" }}
      >
        <div
          className="flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: areaColors[area]?.bg }}
        >
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
          {AREA_LABELS[area]}
        </span>
        <span className="ml-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
          {pendingTasks.length} pending
          {doneTasks.length > 0 ? ` · ${doneTasks.length} completed` : ""}
        </span>
      </div>

      <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {pendingTasks.length > 0 && (
          <PendingTaskList
            tasks={pendingTasks}
            area={area}
            onReorder={onReorderTasks}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onReschedule={onReschedule}
            onMoveTaskBetweenAreas={onMoveTaskBetweenAreas}
            getTagsForIdea={getTagsForIdea}
            allTags={allTags}
            onCreateTag={onCreateTag}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onUndoAction={onUndoAction}
          />
        )}
        {doneTasks.map((task) => (
          <PendingTaskList
            key={task.id}
            tasks={[task]}
            area={area}
            onReorder={() => {}}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onReschedule={onReschedule}
            onMoveTaskBetweenAreas={onMoveTaskBetweenAreas}
            getTagsForIdea={getTagsForIdea}
            allTags={allTags}
            onCreateTag={onCreateTag}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onUndoAction={onUndoAction}
          />
        ))}
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div className="px-5 py-4 text-xs text-gray-400 italic dark:text-gray-500">
            No tasks planned for this day
          </div>
        )}
      </div>

      <div className="rounded-b-2xl border-t border-black/[0.02] bg-black/[0.01] px-4 py-2 dark:border-white/[0.02] dark:bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={areaInputValue}
            onChange={(e) => setAreaInputValue(e.target.value)}
            placeholder={`+ Add to ${AREA_LABELS[area]}...`}
            className="w-full border-none bg-transparent py-1.5 text-xs font-medium text-gray-700 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-gray-300 dark:placeholder:text-gray-600"
            onKeyDown={(e) => {
              if (e.key === "Enter" && areaInputValue.trim()) {
                void onAddTask(areaInputValue.trim(), area);
                setAreaInputValue("");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
