"use client";

import { useRef, useState } from "react";
import type { CreateIdeaPosition, TreeController, TreeItem, TreeNode, TreeUiState } from "./types";

export type InsertZone = "top" | "bottom";

interface UseInsertBandParams<T extends TreeItem> {
  node: TreeNode<T>;
  isLastSibling: boolean;
  ui: TreeUiState;
  controller: TreeController<T>;
  canCreate: boolean;
  clickToInsert: boolean;
  isEditing: boolean;
  isDragging: boolean;
  dndActive: boolean;
  isComposingHere: boolean;
}

/**
 * Hover insertion bands (insert-mode affordance) plus composer creation.
 * Owns the row-content ref so hover math stays next to the state.
 */
export function useInsertBand<T extends TreeItem>({
  node,
  isLastSibling,
  ui,
  controller,
  canCreate,
  clickToInsert,
  isEditing,
  isDragging,
  dndActive,
  isComposingHere,
}: UseInsertBandParams<T>) {
  const [insertZone, setInsertZone] = useState<InsertZone | null>(null);
  const rowContentRef = useRef<HTMLDivElement | null>(null);

  // Hover insertion bands are an insert-mode affordance; edit mode keeps the
  // explicit "+" button but never shows hover-triggered slots.
  const showInsertBand =
    canCreate &&
    clickToInsert &&
    !isEditing &&
    !isDragging &&
    !dndActive &&
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
    if (!el || !canCreate || !clickToInsert || isEditing || dndActive) return;
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

  return {
    insertZone,
    setInsertZone,
    rowContentRef,
    setRowContentRef: (el: HTMLDivElement | null) => {
      rowContentRef.current = el;
    },
    showInsertBand,
    handleInsertHover,
    handleComposerCreate,
  };
}
