"use client";

import { Plus } from "lucide-react";

interface Props {
  nodeCount: number;
  selectedId: string | null;
  onAutoLayout: () => void;
  onFitView: () => void;
  onRemoveSelected: (id: string) => void;
  onAddNode: () => void;
}

export function PathToolbar({
  nodeCount,
  selectedId,
  onAutoLayout,
  onFitView,
  onRemoveSelected,
  onAddNode,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-gray-500">
          {nodeCount} node{nodeCount !== 1 ? "s" : ""}
        </span>
        <button onClick={onFitView} className="toolbar-btn">
          Fit View
        </button>
        <button onClick={onAutoLayout} className="toolbar-btn">
          Auto-Layout
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddNode}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Plus size={13} /> Add Step
        </button>
        {selectedId && (
          <button
            onClick={() => onRemoveSelected(selectedId)}
            className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
