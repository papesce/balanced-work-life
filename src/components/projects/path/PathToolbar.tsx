"use client";

import { Link2, Plus } from "lucide-react";

interface Props {
  stepCount: number;
  completedStepCount: number;
  nextStepTitle: string | null;
  selectedId: string | null;
  onAutoLayout: () => void;
  onFitView: () => void;
  onRemoveSelected: (id: string) => void;
  onAddNode: () => void;
  pathLinksOpen: boolean;
  onTogglePathLinks: () => void;
}

export function PathToolbar({
  stepCount,
  completedStepCount,
  nextStepTitle,
  selectedId,
  onAutoLayout,
  onFitView,
  onRemoveSelected,
  onAddNode,
  pathLinksOpen,
  onTogglePathLinks,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50/50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <span className="text-xs font-medium text-gray-500" aria-live="polite">
          {stepCount} step{stepCount !== 1 ? "s" : ""} · {completedStepCount} done
        </span>
        {nextStepTitle && (
          <span className="max-w-[180px] truncate text-xs font-semibold text-violet-700 dark:text-violet-300">
            Next: {nextStepTitle}
          </span>
        )}
        <button type="button" onClick={onFitView} className="toolbar-btn">
          Fit View
        </button>
        <button type="button" onClick={onAutoLayout} className="toolbar-btn">
          Auto-Layout
        </button>
        <button
          type="button"
          onClick={onTogglePathLinks}
          aria-expanded={pathLinksOpen}
          className="toolbar-btn inline-flex items-center gap-1"
        >
          <Link2 size={12} /> Path links
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddNode}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-700"
        >
          <Plus size={13} /> Add Step
        </button>
        {selectedId && (
          <button
            type="button"
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
