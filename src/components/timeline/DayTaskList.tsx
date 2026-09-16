"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Idea, IdeaLink, LinkType, Tag, LifeArea } from "@/lib/types";
import { RescheduleAction, DayOccurrence } from "@/lib/tasks/rescheduleTask";
import { TimelineTaskRow } from "./TimelineTaskRow";

interface DayTaskListProps {
  occurrences: DayOccurrence[];
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  today: string;
  onGoToDate?: (date: string, taskId: string) => void;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}

function HistoricalOccurrenceRow({
  task,
  occurrenceDate,
  taskTags,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  today,
  onGoToDate,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isHistorical = false,
}: {
  task: Idea;
  occurrenceDate: string;
  taskTags: Tag[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  today: string;
  onGoToDate?: (date: string, taskId: string) => void;
  allTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  isHistorical?: boolean;
}) {
  return (
    <div className="px-1">
      <TimelineTaskRow
        task={task}
        occurrenceDate={occurrenceDate}
        onDone={onDone}
        onUndone={onUndone}
        onUpdate={onUpdate}
        onReschedule={onReschedule}
        onMove={onMove}
        ideas={ideas}
        links={links}
        onCreateLink={onCreateLink}
        onDeleteLink={onDeleteLink}
        today={today}
        dragControls={useDragControls()}
        allTags={allTags}
        taskTags={taskTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
        isHistorical={isHistorical}
        onGoToDate={onGoToDate}
      />
    </div>
  );
}

function DayTaskItem({
  task,
  occurrenceDate,
  onReorder,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  today,
  allTags,
  taskTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  task: Idea;
  occurrenceDate?: string;
  onReorder: () => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMove?: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  ideas?: Idea[];
  links?: IdeaLink[];
  onCreateLink?: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink?: (id: string) => Promise<void>;
  today: string;
  allTags: Tag[];
  taskTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={task} dragControls={controls} className="relative" onDragEnd={onReorder}>
      <TimelineTaskRow
        task={task}
        occurrenceDate={occurrenceDate}
        onDone={onDone}
        onUndone={onUndone}
        onUpdate={onUpdate}
        onReschedule={onReschedule}
        onMove={onMove}
        ideas={ideas}
        links={links}
        onCreateLink={onCreateLink}
        onDeleteLink={onDeleteLink}
        today={today}
        dragControls={controls}
        allTags={allTags}
        taskTags={taskTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
      />
    </Reorder.Item>
  );
}

export function DayTaskList({
  occurrences,
  onReorder,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  onMove,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  today,
  onGoToDate,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: DayTaskListProps) {
  const currentTasks = useMemo(
    () => occurrences.filter((o) => !o.isHistorical).map((o) => o.task),
    [occurrences],
  );
  const historical = useMemo(() => occurrences.filter((o) => o.isHistorical), [occurrences]);
  const [items, setItems] = useState(currentTasks);
  const [prevTasks, setPrevTasks] = useState(currentTasks);
  const itemsRef = useRef(items);

  if (prevTasks !== currentTasks) {
    setPrevTasks(currentTasks);
    setItems(currentTasks);
  }
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  return (
    <>
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        className="space-y-0.5"
        style={{ overflow: "visible" }}
      >
        {items.map((task) => (
          <DayTaskItem
            key={task.id}
            task={task}
            occurrenceDate={task.scheduled_date ?? undefined}
            onReorder={() => onReorder(itemsRef.current)}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onReschedule={onReschedule}
            onMove={onMove}
            ideas={ideas}
            links={links}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            today={today}
            allTags={allTags}
            taskTags={getTagsForIdea(task.id)}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateTag={onCreateTag}
          />
        ))}
      </Reorder.Group>

      {historical.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-amber-200/40 bg-amber-50/40 dark:border-amber-800/30 dark:bg-amber-950/10">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
            Deferred from this date
          </div>
          {historical.map((occ) => (
            <HistoricalOccurrenceRow
              key={occ.task.id}
              task={occ.task}
              occurrenceDate={occ.date}
              taskTags={getTagsForIdea(occ.task.id)}
              onDone={onDone}
              onUndone={onUndone}
              onUpdate={onUpdate}
              onReschedule={onReschedule}
              onMove={onMove}
              ideas={ideas}
              links={links}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              today={today}
              onGoToDate={onGoToDate}
              allTags={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onCreateTag={onCreateTag}
              isHistorical
            />
          ))}
        </div>
      )}
    </>
  );
}
