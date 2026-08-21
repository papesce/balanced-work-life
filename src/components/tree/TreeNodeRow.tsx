"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import { useTree, useTreeDndState } from "./context";
import { TreeComposer } from "./TreeComposer";
import type { DropZone, TreeNode, TreeItem } from "./types";

export function TreeNodeRow<T extends TreeItem>({
  node,
  depth,
}: {
  node: TreeNode<T>;
  depth: number;
}) {
  const { controller, ui, options } = useTree<T>();
  const dnd = useTreeDndState();
  const indentSize = options.indentSize ?? 20;

  const label = options.getLabel(node);
  const isEditing = ui.editingId === node.id;
  const isSelected = ui.selectedId === node.id;
  const [editText, setEditText] = useState(label);
  const [wasEditing, setWasEditing] = useState(isEditing);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync the draft text whenever editing starts (render-time adjustment pattern).
  if (isEditing !== wasEditing) {
    setWasEditing(isEditing);
    if (isEditing) setEditText(label);
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const hasChildren = node.children.length > 0;
  const canCreate = Boolean(controller.onCreate) && !options.disableInsert;
  const canRename = Boolean(controller.onRename);
  const behavior = options.editBehavior ?? {};

  const droppable = useDroppable({ id: `row:${node.id}`, data: { itemId: node.id } });
  const draggable = useDraggable({ id: node.id, data: { itemId: node.id } });
  const isDragging = dnd.activeItemId === node.id;
  const dropZone: DropZone | null = dnd.overItemId === node.id ? dnd.zone : null;

  const startEdit = () => {
    ui.setSelectedId(node.id);
    ui.setEditingId(node.id);
  };

  const confirmEdit = () => {
    const trimmed = editText.trim();
    if (trimmed) {
      if (trimmed !== label && controller.onRename) void controller.onRename(node.id, trimmed);
    } else if (behavior.deleteEmptyOnConfirm && !label && controller.onDelete) {
      void controller.onDelete(node.id);
    }
    ui.setEditingId(null);
  };

  const cancelEdit = () => {
    if (!label && !editText.trim() && behavior.deleteEmptyOnCancel && controller.onDelete) {
      void controller.onDelete(node.id);
    }
    ui.setEditingId(null);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Tab" && behavior.createChildOnTab && controller.onCreate) {
      e.preventDefault();
      confirmEdit();
      const childId = await controller.onCreate("", node.id, "top");
      if (node.collapsed) controller.onToggleCollapse(node.id);
      if (childId) {
        ui.setSelectedId(childId);
        ui.setEditingId(childId);
      }
    }
  };

  const handleCreateChild = async (text: string) => {
    const composing = ui.composing;
    const parentId = composing?.parentId ?? node.id;
    const position = composing?.position === "child" ? "top" : (composing?.position ?? "top");
    const childId = await controller.onCreate?.(text, parentId, position, composing?.meta);
    if (parentId === node.id && node.collapsed) controller.onToggleCollapse(node.id);
    ui.setComposing(null);
    if (childId) ui.setSelectedId(childId);
  };

  const rowClasses = [
    "group relative flex items-center gap-1 rounded-md px-1 py-1",
    options.rowClassName ?? "",
    dropZone === "center" ? "bg-indigo-50 dark:bg-indigo-500/10" : "",
    !dropZone && isSelected ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "",
    isDragging ? "opacity-40" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const setRowRef = (el: HTMLDivElement | null) => {
    droppable.setNodeRef(el);
    draggable.setNodeRef(el);
  };

  return (
    <div className="relative" style={{ paddingLeft: depth > 0 ? indentSize : 0 }}>
      {/* Separator bar - always in DOM when enabled, absolutely positioned to avoid layout shifts */}
      {canCreate && !isEditing && (
        <div
          className="pointer-events-none absolute -top-2 right-0 left-0 z-10"
          style={{ height: 16 }}
        >
          <div
            className="pointer-events-auto absolute inset-x-0 top-1/2 -translate-y-1/2 cursor-pointer opacity-0 transition-opacity hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              ui.setComposing({
                nodeId: node.id,
                parentId: node.parent_id ?? null,
                position: "top",
                depth,
              });
            }}
          >
            <div className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-1 dark:bg-indigo-500/10">
              <div className="h-[2px] flex-1 rounded-full bg-indigo-300 dark:bg-indigo-500" />
              <Plus size={12} strokeWidth={2.5} className="flex-shrink-0 text-indigo-400" />
              <div className="h-[2px] flex-1 rounded-full bg-indigo-300 dark:bg-indigo-500" />
            </div>
          </div>
        </div>
      )}

      <div
        ref={setRowRef}
        className={rowClasses}
        onClick={(e) => {
          e.stopPropagation();
          ui.setSelectedId(isSelected ? null : node.id);
        }}
      >
        {/* Drop indicators */}
        {dropZone === "top" && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 rounded-full bg-indigo-400" />
        )}
        {dropZone === "bottom" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0.5 rounded-full bg-indigo-400" />
        )}

        {/* Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) controller.onToggleCollapse(node.id);
          }}
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

        {/* Add child button - appears on hover */}
        {canCreate && !isEditing && (
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
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        )}

        {/* Drag handle */}
        {Boolean(controller.onMove) && (
          <span
            // dnd-kit's API requires passing these during render; they are a
            // callback ref and stable handlers, not render-time ref reads.
            /* eslint-disable-next-line react-hooks/refs */
            ref={draggable.setActivatorNodeRef}
            /* eslint-disable-next-line react-hooks/refs */
            {...draggable.attributes}
            /* eslint-disable-next-line react-hooks/refs */
            {...draggable.listeners}
            className="flex flex-shrink-0 cursor-grab touch-none items-center text-gray-300 select-none hover:text-gray-500"
          >
            <GripVertical size={14} strokeWidth={1.5} />
          </span>
        )}

        {options.renderLeading?.(node)}

        {/* Text */}
        {isEditing && canRename ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={confirmEdit}
            className="max-w-sm min-w-0 flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm outline-none focus:border-indigo-500"
            placeholder={options.editPlaceholder ?? "Type an item..."}
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (canRename) {
                startEdit();
              } else {
                ui.setSelectedId(isSelected ? null : node.id);
              }
            }}
            className={`max-w-sm min-w-0 flex-1 cursor-text truncate rounded px-2 py-0.5 text-sm hover:bg-gray-100 dark:hover:bg-white/[0.04] ${
              options.labelClassName?.(node) ?? ""
            }`}
          >
            {label || <span className="text-gray-400 italic">{options.emptyLabel ?? ""}</span>}
          </span>
        )}

        {options.renderTrailing?.(node)}
      </div>

      {ui.composing?.nodeId === node.id && canCreate && !node.collapsed && !isEditing && (
        <TreeComposer
          depth={ui.composing.depth}
          placeholder={
            options.composerPlaceholder?.(ui.composing) ??
            (ui.composing.position === "child" ? "Add child..." : "Add item...")
          }
          leading={options.composerLeading?.(node, ui.composing, (meta) =>
            ui.setComposing({ ...ui.composing!, meta }),
          )}
          onCreate={handleCreateChild}
          onDismiss={() => ui.setComposing(null)}
        />
      )}

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
