"use client";

import type { ReactNode } from "react";
import { TreeProvider } from "./context";
import { TreeNodeRow } from "./TreeNodeRow";
import { TreeDnd } from "./useTreeDnd";
import type { TreeController, TreeItem, TreeNode, TreeOptions, TreeUiState } from "./types";

export interface TreeViewProps<T extends TreeItem> extends TreeOptions<T> {
  /** Already-filtered root nodes (filtering is the host's responsibility). */
  nodes: TreeNode<T>[];
  items: T[];
  onMove: TreeController<T>["onMove"];
  onCreate?: TreeController<T>["onCreate"];
  onRename?: TreeController<T>["onRename"];
  onDelete?: TreeController<T>["onDelete"];
  onToggleCollapse: TreeController<T>["onToggleCollapse"];
  onExpand: TreeController<T>["onExpand"];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  composing: TreeUiState["composing"];
  setComposing: TreeUiState["setComposing"];
  emptyMessage?: ReactNode;
  /** Classes for the wrapper around root rows (e.g. spacing or dividers). */
  rowsClassName?: string;
  className?: string;
}

export function TreeView<T extends TreeItem>({
  nodes,
  items,
  onMove,
  onCreate,
  onRename,
  onDelete,
  onToggleCollapse,
  onExpand,
  selectedId,
  setSelectedId,
  editingId,
  setEditingId,
  composing,
  setComposing,
  emptyMessage,
  rowsClassName = "space-y-0.5",
  className,
  ...options
}: TreeViewProps<T>) {
  const controller: TreeController<T> = {
    items,
    onMove,
    onCreate,
    onRename,
    onDelete,
    onToggleCollapse,
    onExpand,
  };

  const ui: TreeUiState = {
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    composing,
    setComposing,
  };

  return (
    <TreeDnd items={items} onMove={onMove} getLabel={options.getLabel}>
      <TreeProvider value={{ controller, ui, options }}>
        <div
          className={className}
          onClick={() => {
            setSelectedId(null);
            setComposing(null);
          }}
        >
          {nodes.length === 0 ? (
            (emptyMessage ?? null)
          ) : (
            <div className={rowsClassName}>
              {nodes.map((node) => (
                <TreeNodeRow key={node.id} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>
      </TreeProvider>
    </TreeDnd>
  );
}
