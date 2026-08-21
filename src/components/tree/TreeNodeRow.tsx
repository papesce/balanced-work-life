"use client";

import { useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import { useTree, useTreeDndState } from "./context";
import { TreeComposer } from "./TreeComposer";
import type { CreateIdeaPosition, DropZone, TreeItem, TreeNode } from "./types";

type InsertZone = "top" | "bottom";

export function TreeNodeRow<T extends TreeItem>({
  node,
  depth,
  isLastSibling,
}: {
  node: TreeNode<T>;
  depth: number;
  isLastSibling: boolean;
}) {
  const { controller, ui, options } = useTree<T>();
  const dnd = useTreeDndState();
  const indentSize = options.indentSize ?? 20;
  const insertBandLeadingOffset = 3 * 20;

  const label = options.getLabel(node);
  const isEditing = ui.editingId === node.id;
  const isSelected = ui.selectedId === node.id;
  const [editText, setEditText] = useState(label);
  const [wasEditing, setWasEditing] = useState(isEditing);
  const [insertZone, setInsertZone] = useState<InsertZone | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowContentRef = useRef<HTMLDivElement | null>(null);

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

  const droppable = useDroppable({ id: `row:${node.id}`, data: { itemId: node.id, depth } });
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

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  const isComposingHere = ui.composing?.nodeId === node.id;
  const showInsertBand =
    canCreate &&
    !isEditing &&
    !isDragging &&
    !dnd.activeItemId &&
    !isComposingHere &&
    insertZone !== null;

  /**
   * Insertion-band detection: pointer Y within the row's top/bottom third.
   * Measured against the row-content rect, so hovering the composer or child
   * rows below never triggers this row's band. The band button lives inside
   * the row bounds (unlike the old straddling hotzone), so it never steals
   * clicks from neighboring rows.
   */
  const handleInsertHover = (e: React.MouseEvent) => {
    const el = rowContentRef.current;
    if (!el || !canCreate || isEditing || dnd.activeItemId) return;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < -4 || y > rect.height + 4) {
      setInsertZone((prev) => (prev === null ? prev : null));
      return;
    }
    const third = rect.height / 3;
    const next: InsertZone | null =
      y < third ? "top" : y > third * 2 && isLastSibling ? "bottom" : null;
    setInsertZone((prev) => (prev === next ? prev : next));
  };

  const handleComposerCreate = async (text: string) => {
    const composing = ui.composing;
    if (!composing) return;
    const isChild = composing.position === "child";
    const parentId = isChild ? node.id : (node.parent_id ?? null);
    const position: CreateIdeaPosition = isChild
      ? "top"
      : composing.position === "top"
        ? { beforeId: node.id }
        : { afterId: node.id };
    const childId = await controller.onCreate?.(text, parentId, position, composing.meta);
    if (isChild && node.collapsed) controller.onToggleCollapse(node.id);
    ui.setComposing(null);
    if (childId) ui.setSelectedId(childId);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return; // the edit input handles its own keys
    if (e.target !== e.currentTarget) return; // nested buttons keep native key activation
    if (e.key === "Enter") {
      e.preventDefault();
      if (!canCreate) return;
      ui.setSelectedId(node.id);
      ui.setComposing({
        nodeId: node.id,
        parentId: node.parent_id ?? null,
        position: "bottom",
        depth,
      });
    } else if (e.key === "F2" && canRename) {
      e.preventDefault();
      startEdit();
    }
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
    rowContentRef.current = el;
  };

  const composer = isComposingHere ? (
    <TreeComposer
      depth={ui.composing!.depth}
      placeholder={
        options.composerPlaceholder?.(ui.composing!) ??
        (ui.composing!.position === "child" ? "Add child..." : "Add item...")
      }
      leading={options.composerLeading?.(node, ui.composing!, (meta) =>
        ui.setComposing({ ...ui.composing!, meta }),
      )}
      onCreate={handleComposerCreate}
      onDismiss={() => ui.setComposing(null)}
    />
  ) : null;

  return (
    <>
      <div
        style={{ paddingLeft: depth > 0 ? indentSize : 0 }}
        onMouseLeave={() => setInsertZone(null)}
      >
        {/* Inner positioning context: contains only this row (+composers), so
            absolutely-positioned bands anchor to the row, not the subtree. */}
        <div className="relative">
          {/* Insertion band: dashed line + "+" = create, distinct from the solid
          indigo lines used for drag-move. Depth-indented so the drawn slot
          matches the created slot. Click target stays inside row bounds. */}
          {showInsertBand && insertZone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ui.setComposing({
                  nodeId: node.id,
                  parentId: node.parent_id ?? null,
                  position: insertZone,
                  depth,
                });
                setInsertZone(null);
              }}
              aria-label={`Insert item ${insertZone === "top" ? "above" : "below"} ${label || "this item"}`}
              className="absolute right-0 z-10 flex cursor-pointer items-center px-0.5"
              style={{
                // This is absolutely positioned outside the row's normal-flow
                // content, so it needs its own depth offset to align with the
                // item being inserted.
                left: depth * indentSize + insertBandLeadingOffset,
                ...(insertZone === "top"
                  ? { top: 0, height: `${100 / 3}%`, alignItems: "center" }
                  : { bottom: 0, height: `${100 / 3}%`, alignItems: "center" }),
              }}
            >
              <span className="h-[2px] w-5 flex-shrink-0 rounded-full bg-indigo-400 dark:bg-indigo-500" />
              <span className="h-0 min-w-0 flex-1 border-t-2 border-dashed border-indigo-300 dark:border-indigo-500/60" />
              <Plus
                size={12}
                strokeWidth={2.5}
                className="flex-shrink-0 self-center text-indigo-400"
              />
            </button>
          )}

          {/* Composer opens exactly where the insertion slot is:
          above the row for "top", below it for "child"/"bottom" — never
          inside the children container. */}
          {composer && ui.composing!.position === "top" && composer}

          <div
            ref={setRowRef}
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={isSelected}
            aria-expanded={hasChildren ? !node.collapsed : undefined}
            tabIndex={isSelected ? 0 : -1}
            className={rowClasses}
            onMouseMove={handleInsertHover}
            onClick={(e) => {
              e.stopPropagation();
              ui.setSelectedId(isSelected ? null : node.id);
            }}
            onKeyDown={handleRowKeyDown}
          >
            {/* Drop indicators (drag-move: solid lines) */}
            {dropZone === "top" && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 rounded-full bg-indigo-400" />
            )}
            {dropZone === "bottom" && (
              <div
                className="pointer-events-none absolute bottom-0 z-20"
                style={{
                  left: `${(dnd.targetDepth !== null ? dnd.targetDepth - depth : 0) * indentSize}px`,
                  right: 0,
                }}
              >
                <div className="relative h-0.5 rounded-full bg-indigo-400">
                  <div className="absolute top-1/2 left-0 h-1.5 w-1.5 -translate-x-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                </div>
              </div>
            )}

            {/* Collapse toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) controller.onToggleCollapse(node.id);
              }}
              aria-label={
                hasChildren
                  ? `${node.collapsed ? "Expand" : "Collapse"} ${label || "item"}`
                  : undefined
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
                aria-label={`Add child under ${label || "this item"}`}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 focus-visible:text-indigo-500 focus-visible:opacity-100 dark:text-gray-600 dark:hover:text-indigo-400"
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
                aria-label={`Move ${label || "item"}`}
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
                onKeyDown={handleInputKeyDown}
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

          {composer && ui.composing!.position !== "top" && composer}
        </div>
      </div>

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div role="group">
          {node.children.map((child, index) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              isLastSibling={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </>
  );
}
