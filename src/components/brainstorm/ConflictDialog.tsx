"use client";

import { Task, TimeBucket } from "@/lib/types";

const BUCKET_LABELS: Record<TimeBucket, string> = {
  today: "Hoy",
  tomorrow: "Mañana",
  next_week: "Semana",
  backlog: "Backlog",
};

interface ConflictDialogProps {
  existingTask: Task;
  targetBucket: TimeBucket;
  onMove: () => void;
  onCancel: () => void;
}

export function ConflictDialog({
  existingTask,
  targetBucket,
  onMove,
  onCancel,
}: ConflictDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-80 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Esta idea ya tiene una tarea activa
        </h3>
        <p className="text-sm text-gray-600">
          Asignada actualmente a:{" "}
          <span className="font-medium text-gray-800">
            {BUCKET_LABELS[existingTask.time_bucket]}
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onMove}
            className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            Mover a {BUCKET_LABELS[targetBucket]}
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
