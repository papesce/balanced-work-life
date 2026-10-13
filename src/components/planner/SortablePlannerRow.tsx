"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlannerTaskRow } from "@/components/planner/PlannerTaskRow";
import type { PlannerRowProps } from "@/components/planner/plannerRowTypes";

export function SortablePlannerRow(props: PlannerRowProps) {
  const { task, area } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      kind: "planner-task",
      taskId: task.id,
      area,
      title: task.text,
      durationMinutes: task.duration_minutes ?? 30,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10 opacity-40" : ""}`}
    >
      <PlannerTaskRow
        {...props}
        showDragHandle
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}
