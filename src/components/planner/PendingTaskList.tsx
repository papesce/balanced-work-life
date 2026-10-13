"use client";

import { useMemo } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortablePlannerRow } from "@/components/planner/SortablePlannerRow";
import type { PlannerRowProps } from "@/components/planner/plannerRowTypes";
import type { Idea, LifeArea } from "@/lib/types";

interface PendingTaskListProps extends Omit<
  PlannerRowProps,
  "task" | "showDragHandle" | "dragHandleProps" | "isDragging"
> {
  tasks: Idea[];
  area: LifeArea;
}

export function PendingTaskList({ tasks, area, ...rowProps }: PendingTaskListProps) {
  // Sortable ids derive directly from props — dnd-kit handles drag
  // transforms internally, so no local reorder state is needed.
  const itemIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      {tasks.map((task) => (
        <SortablePlannerRow key={task.id} task={task} area={area} {...rowProps} />
      ))}
    </SortableContext>
  );
}
