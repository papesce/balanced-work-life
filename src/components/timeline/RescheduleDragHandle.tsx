"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarDays } from "lucide-react";

export function RescheduleDragHandle({
  taskId,
  fromDate,
  idPrefix,
}: {
  taskId: string;
  fromDate: string;
  idPrefix: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${idPrefix}-detail-${taskId}-${fromDate}`,
    data: { taskId, fromDate },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title="Drag onto a day to reschedule"
      aria-label="Drag to reschedule to another day"
      className={`flex-shrink-0 cursor-grab touch-none text-gray-300 transition-colors hover:text-violet-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-violet-400 ${isDragging ? "opacity-40" : "opacity-0 group-hover:opacity-100"}`}
    >
      <CalendarDays size={13} />
    </button>
  );
}
