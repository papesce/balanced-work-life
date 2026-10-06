"use client";

import { useDraggable } from "@dnd-kit/core";
import { Idea } from "@/lib/types";

export const TASK_STATUS_DOT: Record<string, string> = {
  completed: "bg-violet-500",
  cancelled: "bg-red-400",
  missed: "bg-rose-400",
  in_progress: "bg-amber-500",
  paused: "bg-orange-400",
  scheduled: "bg-sky-500",
  planned: "bg-gray-300 dark:bg-gray-600",
  deferred: "bg-gray-300 dark:bg-gray-600",
  archived: "bg-gray-300 dark:bg-gray-600",
};

interface TaskChipProps {
  task: Idea;
  date: string;
  /** Prefix to keep dnd ids unique per view ("month" | "week"). */
  idPrefix: string;
  onOpen: () => void;
  justDraggedRef: React.MutableRefObject<number>;
}

export function TaskChip({ task, date, idPrefix, onOpen, justDraggedRef }: TaskChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${idPrefix}-chip-${task.id}-${date}`,
    data: { taskId: task.id, fromDate: date },
  });
  const done =
    task.status === "completed" || task.status === "cancelled" || task.status === "missed";
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (Date.now() - justDraggedRef.current < 300) return;
        onOpen();
      }}
      title={task.scheduled_time ? `${task.text} · ${task.scheduled_time.slice(0, 5)}` : task.text}
      className={`flex w-full cursor-grab items-center gap-1 truncate rounded-md px-1 py-px text-left text-[10px] font-medium transition-colors hover:bg-black/[0.06] active:cursor-grabbing dark:hover:bg-white/[0.08] ${
        done ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-700 dark:text-gray-200"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${TASK_STATUS_DOT[task.status] ?? TASK_STATUS_DOT.planned}`}
      />
      {task.scheduled_time && (
        <span className="flex-shrink-0 font-semibold text-violet-600 tabular-nums dark:text-violet-400">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}
      <span className="truncate">{task.text || "Untitled"}</span>
    </button>
  );
}
