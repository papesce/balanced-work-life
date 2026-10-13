"use client";

import { ArrowRightToLine } from "lucide-react";

/**
 * Add-to-path handle (opt-in, project split view only). Native HTML5 drag
 * with the same payload as the canvas tray; the @dnd-kit grip stays
 * exclusively for reordering.
 */
export function PathHandle({
  nodeId,
  label,
  onAddToPath,
  isInPath,
  pathAddDisabled,
}: {
  nodeId: string;
  label: string;
  onAddToPath: (id: string) => void;
  isInPath: boolean;
  pathAddDisabled: boolean;
}) {
  const disabled = isInPath || pathAddDisabled;
  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={
        isInPath ? `Already in path: ${label || "item"}` : `Add ${label || "item"} to path`
      }
      title={
        isInPath
          ? "Already in this path"
          : pathAddDisabled
            ? "Select or create a path first"
            : "Drag onto the canvas, or click to add to the path"
      }
      draggable={!disabled}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData("application/project-task", nodeId);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onAddToPath(nodeId);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          e.stopPropagation();
          onAddToPath(nodeId);
        }
      }}
      className={`flex flex-shrink-0 items-center select-none ${
        disabled
          ? "cursor-not-allowed text-gray-200 opacity-40 dark:text-gray-700"
          : "cursor-grab text-violet-300 hover:text-violet-600 active:cursor-grabbing dark:text-gray-600 dark:hover:text-violet-400"
      }`}
    >
      <ArrowRightToLine size={14} strokeWidth={1.5} />
    </span>
  );
}
