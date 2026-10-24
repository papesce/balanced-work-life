"use client";

import { useEffect, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTree, useTreeDndState } from "./context";
import { TreeComposer } from "./TreeComposer";
import { InsertBand } from "./InsertBand";
import { PathHandle } from "./PathHandle";
import { RowChrome } from "./RowChrome";
import { RowLabel } from "./RowLabel";
import { useInsertBand } from "./useInsertBand";
import { useRowEditing } from "./useRowEditing";
import type { TreeItem, TreeNode } from "./types";

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
  const insertBandLeadingOffset = 3 * indentSize;

  const label = options.getLabel(node);
  const hasChildren = node.children.length > 0;
  const canCreate = Boolean(controller.onCreate) && !options.disableInsert;
  const canRename = Boolean(controller.onRename);
  const inlineEditEnabled = options.inlineEditEnabled ?? true;
  const clickToInsert = Boolean(options.clickToInsert) && canCreate;
  const behavior = options.editBehavior ?? {};
  const isCardMode = Boolean(options.cardMode);
  const notesText = (node as unknown as { notes?: string | null }).notes?.trim() ?? "";

  const canExpand = options.canExpand?.(node) ?? false;
  const isExpandable = hasChildren || canExpand;
  const isVirtualNode = options.isVirtualNode?.(node) ?? false;

  const editing = useRowEditing({
    node,
    label,
    depth,
    ui,
    controller,
    canRename,
    canCreate,
    inlineEditEnabled,
    behavior,
  });
  const { isEditing, isSelected } = editing;

  const droppable = useDroppable({ id: `row:${node.id}`, data: { itemId: node.id, depth } });
  const draggable = useDraggable({
    id: node.id,
    data: { itemId: node.id },
    disabled: isVirtualNode,
  });
  const isDragging = dnd.activeItemId === node.id;
  const dropZone = dnd.overItemId === node.id ? dnd.zone : null;

  const band = useInsertBand({
    node,
    isLastSibling,
    ui,
    controller,
    canCreate,
    clickToInsert,
    isEditing,
    isDragging,
    dndActive: Boolean(dnd.activeItemId),
    isComposingHere: ui.composing?.nodeId === node.id,
  });

  const detailRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isSelected && options.renderDetail) {
      detailRef.current?.scrollIntoView({ block: "nearest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);

  const rowClasses = isCardMode
    ? [
        "group relative flex items-start gap-1 rounded-xl border bg-white/80 px-2 py-2 shadow-sm dark:border-white/10 dark:bg-gray-800/60",
        options.rowClassName ?? "",
        dropZone === "center" ? "bg-indigo-50 dark:bg-indigo-500/10" : "",
        !dropZone && isSelected ? "ring-2 ring-indigo-400 dark:ring-indigo-500" : "border-black/5",
        isDragging ? "opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        "group relative flex items-center gap-1 rounded-md px-1 py-1",
        options.rowClassName ?? "",
        dropZone === "center" ? "bg-indigo-50 dark:bg-indigo-500/10" : "",
        !dropZone && isSelected ? "bg-indigo-100/70 dark:bg-indigo-500/15" : "",
        isDragging ? "opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ");

  const setRowRef = (el: HTMLDivElement | null) => {
    droppable.setNodeRef(el);
    band.setRowContentRef(el);
  };

  const isComposingHere = ui.composing?.nodeId === node.id;
  const composer = isComposingHere ? (
    <TreeComposer
      depth={ui.composing!.depth}
      indentSize={indentSize}
      placeholder={
        options.composerPlaceholder?.(ui.composing!) ??
        (ui.composing!.position === "child" ? "Add child..." : "Add item...")
      }
      leading={options.composerLeading?.(node, ui.composing!, (meta) =>
        ui.setComposing({ ...ui.composing!, meta }),
      )}
      onCreate={band.handleComposerCreate}
      onDismiss={() => ui.setComposing(null)}
    />
  ) : null;

  return (
    <>
      <div
        style={{ paddingLeft: depth * indentSize }}
        onMouseLeave={() => band.setInsertZone(null)}
      >
        {/* Inner positioning context: contains only this row (+composers), so
            absolutely-positioned bands anchor to the row, not the subtree. */}
        <div className="relative">
          {/* Insertion band: dashed line + "+" = create, distinct from the solid
          indigo lines used for drag-move. Depth-indented so the drawn slot
          matches the created slot. Click target stays inside row bounds. */}
          {band.showInsertBand && band.insertZone && (
            <InsertBand
              label={label}
              depth={depth}
              indentSize={indentSize}
              insertBandLeadingOffset={insertBandLeadingOffset}
              insertZone={band.insertZone}
              onInsert={(position) => {
                ui.setComposing({
                  nodeId: node.id,
                  parentId: node.parent_id ?? null,
                  position,
                  depth,
                });
                band.setInsertZone(null);
              }}
            />
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
            aria-expanded={isExpandable ? !node.collapsed : undefined}
            tabIndex={isSelected ? 0 : -1}
            className={rowClasses}
            id={`idea-${node.id}`}
            data-idea-id={node.id}
            onMouseMove={band.handleInsertHover}
            onContextMenu={(e) => options.onContextMenu?.(node, e)}
            onClick={(e) => {
              e.stopPropagation();
              if (clickToInsert && !isEditing) {
                ui.setSelectedId(node.id);
                ui.setComposing({
                  nodeId: node.id,
                  parentId: node.parent_id ?? null,
                  position: "bottom",
                  depth,
                });
              } else {
                ui.setSelectedId(isSelected ? null : node.id);
              }
            }}
            onKeyDown={editing.handleRowKeyDown}
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

            <RowChrome
              node={node}
              label={label}
              depth={depth}
              hasChildren={isExpandable}
              controller={controller}
              ui={ui}
              canCreate={canCreate}
              clickToInsert={clickToInsert}
              isEditing={isEditing}
              draggable={draggable}
              isVirtualNode={isVirtualNode}
            />

            {/* Add-to-path handle (opt-in, project split view only). Native
            HTML5 drag with the same payload as the canvas tray; the @dnd-kit
            grip above stays exclusively for reordering. */}
            {options.onAddToPath && (
              <PathHandle
                nodeId={node.id}
                label={label}
                onAddToPath={options.onAddToPath}
                isInPath={options.isInPath?.(node.id) ?? false}
                pathAddDisabled={
                  typeof options.pathAddDisabled === "function"
                    ? options.pathAddDisabled(node.id)
                    : (options.pathAddDisabled ?? false)
                }
              />
            )}

            {options.renderLeading?.(node)}

            {/* Text */}
            <RowLabel
              node={node}
              label={label}
              options={options}
              isCardMode={isCardMode}
              notesText={notesText}
              isEditing={isEditing}
              canRename={canRename}
              inputRef={editing.inputRef}
              editText={editing.editText}
              onEditTextChange={editing.setEditText}
              onInputKeyDown={editing.handleInputKeyDown}
              onConfirmEdit={editing.confirmEdit}
              clickToInsert={clickToInsert}
              onLabelClick={editing.handleLabelClick}
              onInsertLabelClick={editing.handleInsertLabelClick}
            />

            {!isCardMode && options.renderTrailing?.(node)}
          </div>
          {options.renderSubtitle?.(node)}
          {options.renderAfterRow?.(node)}

          {options.renderDetail && isSelected && (
            <div
              ref={detailRef}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {options.renderDetail(node)}
            </div>
          )}

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
