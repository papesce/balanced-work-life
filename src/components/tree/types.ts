import type { ReactNode } from "react";
import type { CreateIdeaPosition } from "../../hooks/useIdeas";

export type { CreateIdeaPosition };

/**
 * Minimal structural contract for items rendered by the generic tree.
 * Field names intentionally mirror the app's DB-backed domain types
 * (`Idea` etc.), so those satisfy `TreeItem` without any mapping.
 */
export interface TreeItem {
  id: string;
  parent_id: string | null;
  sort_order: number;
}

/** A `TreeItem` enriched with runtime nesting/UI state by `buildTree`. */
export type TreeNode<T extends TreeItem = TreeItem> = T & {
  children: TreeNode<T>[];
  collapsed: boolean;
};

/** Where the pointer is hovering within a drop-target row. */
export type DropZone = "top" | "center" | "bottom";

export interface DropTarget {
  parent_id: string | null;
  sort_order: number;
}

/**
 * Pending inline-composer placement, anchored to a node.
 * - "top"/"bottom": new sibling directly above/below the anchor node
 * - "child": first child of the anchor node
 * `meta` is opaque caller data (e.g. horizon's chosen item type) that is
 * forwarded to `onCreate`.
 */
export interface ComposingState {
  nodeId: string;
  parentId: string | null;
  position: "child" | "top" | "bottom";
  depth: number;
  meta?: unknown;
}

export interface TreeEditBehavior {
  /** Deleting all text and confirming removes the node (requires onDelete). */
  deleteEmptyOnConfirm?: boolean;
  /** Cancelling an edit on a node that has no label removes it (requires onDelete). */
  deleteEmptyOnCancel?: boolean;
  /** Tab inside the edit input confirms and creates an empty child (requires onCreate). */
  createChildOnTab?: boolean;
}

/** Data + mutation surface the tree needs from its host. */
export interface TreeController<T extends TreeItem> {
  /** Flat list of all items; used for descendant/cycle checks during DnD. */
  items: T[];
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => void | Promise<void>;
  onCreate?: (
    text: string,
    parentId: string | null,
    position: CreateIdeaPosition,
    meta?: unknown,
  ) => Promise<string | void> | string | void;
  /** Rename the node's primary label; enables inline editing when provided. */
  onRename?: (id: string, label: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  onToggleCollapse: (id: string) => void;
  onExpand: (id: string) => void;
}

/** Ephemeral UI state owned by the host page and passed down. */
export interface TreeUiState {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  composing: ComposingState | null;
  setComposing: (composing: ComposingState | null) => void;
}

/** Visual/behavioral customization hooks. All optional except getLabel. */
export interface TreeOptions<T extends TreeItem> {
  getLabel: (item: T) => string;
  /** Muted placeholder shown when the label is empty. */
  emptyLabel?: string;
  editPlaceholder?: string;
  /** Extra classes for the label span (e.g. status-based text colors). */
  labelClassName?: (node: TreeNode<T>) => string;
  /** Rendered between the drag handle and the label (e.g. status icon). */
  renderLeading?: (node: TreeNode<T>) => ReactNode;
  /** Rendered after the label (pills, chips, menus...). */
  renderTrailing?: (node: TreeNode<T>) => ReactNode;
  /** Optional content at the start of the inline composer row. */
  composerLeading?: (
    node: TreeNode<T>,
    composing: ComposingState,
    setMeta: (meta: unknown) => void,
  ) => ReactNode;
  composerPlaceholder?: (composing: ComposingState) => string;
  /** Extra classes appended to every row. */
  rowClassName?: string;
  /** Pixels of indentation per depth level. */
  indentSize?: number;
  /** Hides the "+" add-child button and the hover insertion bands. */
  disableInsert?: boolean;
  editBehavior?: TreeEditBehavior;
}
