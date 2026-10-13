"use client";

export function WorkflowToolbar({
  done,
  total,
  canLayout,
  selectedId,
  onAutoLayout,
  onFitView,
  onRemoveSelected,
}: {
  done: number;
  total: number;
  canLayout: boolean;
  selectedId: string | null;
  onAutoLayout: () => void;
  onFitView: () => void;
  onRemoveSelected: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      <div className="flex items-center gap-1">
        <span
          className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          title="Completed or cancelled steps out of all steps in this path"
        >
          {done}/{total} done
        </span>
        <button
          onClick={onAutoLayout}
          disabled={!canLayout}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
        >
          Auto layout
        </button>
        <button
          onClick={onFitView}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Fit view
        </button>
        {selectedId && (
          <button
            onClick={onRemoveSelected}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            Remove from path
          </button>
        )}
      </div>
    </div>
  );
}
