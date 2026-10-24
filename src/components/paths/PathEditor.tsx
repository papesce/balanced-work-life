"use client";

import { PathView, PathCanvasProvider } from "@/components/projects/PathView";
import { PathPreviewSvg } from "./PathPreviewSvg";

export interface PathEditorProps {
  pathId: string;
  mode?: "preview" | "edit";
  fillHeight?: boolean;
  onOpenFullEdit?: () => void;
  className?: string;
  compact?: boolean;
}

export function PathEditor({
  pathId,
  mode = "edit",
  fillHeight = false,
  onOpenFullEdit,
  className = "",
  compact = false,
}: PathEditorProps) {
  if (mode === "preview") {
    return (
      <div
        className={`group relative rounded-lg border border-gray-200/80 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-gray-800/30 ${className}`}
        onClick={onOpenFullEdit}
      >
        <PathPreviewSvg pathId={pathId} compact={compact} />
        {onOpenFullEdit && (
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullEdit();
              }}
              className="rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              Open editor →
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <PathCanvasProvider>
        <PathView pathId={pathId} fillHeight={fillHeight} />
      </PathCanvasProvider>
    </div>
  );
}

export { PathCanvasProvider };
