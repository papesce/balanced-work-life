"use client";

import { Plus } from "lucide-react";

interface Props {
  onAdd: () => void;
}

export function PathEmptyState({ onAdd }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-400 dark:bg-gray-800">
        <Plus size={32} />
      </div>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No steps defined yet</p>
      <p className="mt-1 mb-6 text-xs text-gray-400">
        Add your first step to start mapping the path.
      </p>
      <button
        onClick={onAdd}
        className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-700"
      >
        Add First Step
      </button>
    </div>
  );
}
