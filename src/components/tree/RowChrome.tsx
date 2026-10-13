"use client";

import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import type { TreeController, TreeItem, TreeNode, TreeUiState } from "./types";

/** Collapse toggle + add-child button + drag grip for one tree row. */
export function RowChrome<T extends TreeItem>({
  node,
  label,
  depth,
  hasChildren,
  controller,
  ui,
  canCreate,
  clickToInsert,
  isEditing,
  draggable,
}: {
  node: TreeNode<T>;
  label: string;
  depth: number;
  hasChildren: boolean;
  controller: TreeController<T>;
  ui: TreeUiState;
  canCreate: boolean;
  clickToInsert: boolean;
  isEditing: boolean;
  draggable: {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners: Record<string, unknown> | undefined;
    setNodeRef: (el: HTMLSpanElement | null) => void;
    setActivatorNodeRef: (el: HTMLSpanElement | null) => void;
  };
}) {
  const setDragHandleRef = (el: HTMLSpanElement | null) => {
    draggable.setNodeRef(el);
    draggable.setActivatorNodeRef(el);
  };
  return (
    <>
      {/* Collapse toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) controller.onToggleCollapse(node.id);
        }}
        aria-label={
          hasChildren ? `${node.collapsed ? "Expand" : "Collapse"} ${label || "item"}` : undefined
        }
        aria-hidden={!hasChildren}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-gray-400 hover:text-gray-600"
      >
        {hasChildren ? (
          node.collapsed ? (
            <ChevronRight size={14} strokeWidth={2} />
          ) : (
            <ChevronDown size={14} strokeWidth={2} />
          )
        ) : null}
      </button>

      {/* Add child button - insert mode only, appears on hover */}
      {canCreate && clickToInsert && !isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            ui.setComposing({
              nodeId: node.id,
              parentId: node.id,
              position: "child",
              depth: depth + 1,
            });
          }}
          title="Add child"
          aria-label={`Add child under ${label || "this item"}`}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 focus-visible:text-indigo-500 focus-visible:opacity-100 dark:text-gray-600 dark:hover:text-indigo-400"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      )}

      {/* Drag handle */}
      {Boolean(controller.onMove) && (
        <span
          // Measure from the grip so the compact drag overlay tracks the
          // pointer instead of inheriting the full row's dimensions.
          ref={setDragHandleRef}
          {...draggable.attributes}
          {...draggable.listeners}
          aria-label={`Move ${label || "item"}`}
          className="flex flex-shrink-0 cursor-grab touch-none items-center text-gray-300 select-none hover:text-gray-500"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </span>
      )}
    </>
  );
}
