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
  isVirtualNode,
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
  isVirtualNode?: boolean;
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
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800"
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
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-indigo-500 focus-visible:bg-gray-100 focus-visible:text-indigo-500 focus-visible:opacity-100 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400 dark:focus-visible:bg-gray-800"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      )}

      {/* Drag handle */}
      {Boolean(controller.onMove) && !isVirtualNode && (
        <span
          // Measure from the grip so the compact drag overlay tracks the
          // pointer instead of inheriting the full row's dimensions.
          ref={setDragHandleRef}
          {...draggable.attributes}
          {...draggable.listeners}
          aria-label={`Move ${label || "item"}`}
          className="flex h-8 w-8 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-gray-300 select-none hover:bg-gray-100 hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-gray-800"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </span>
      )}
    </>
  );
}
