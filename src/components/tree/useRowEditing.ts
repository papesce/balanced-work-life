"use client";

import { useEffect, useRef, useState } from "react";
import type { TreeController, TreeEditBehavior, TreeItem, TreeNode, TreeUiState } from "./types";

interface UseRowEditingParams<T extends TreeItem> {
  node: TreeNode<T>;
  label: string;
  depth: number;
  ui: TreeUiState;
  controller: TreeController<T>;
  canRename: boolean;
  canCreate: boolean;
  inlineEditEnabled: boolean;
  behavior: TreeEditBehavior;
}

/**
 * Inline-edit lifecycle for one tree row: draft sync, focus, confirm/
 * cancel (with empty-delete behaviors), Tab-to-create-child, label clicks,
 * and row keyboard shortcuts.
 */
export function useRowEditing<T extends TreeItem>({
  node,
  label,
  depth,
  ui,
  controller,
  canRename,
  canCreate,
  inlineEditEnabled,
  behavior,
}: UseRowEditingParams<T>) {
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

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected && canRename && inlineEditEnabled) {
      startEdit();
    } else {
      ui.setSelectedId(node.id);
    }
  };

  /** Label click when the row is in click-to-insert mode (starts a composer). */
  const handleInsertLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ui.setSelectedId(node.id);
    ui.setComposing({
      nodeId: node.id,
      parentId: node.parent_id ?? null,
      position: "bottom",
      depth,
    });
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
    } else if (e.key === "F2" && canRename && inlineEditEnabled) {
      e.preventDefault();
      startEdit();
    }
  };

  return {
    isEditing,
    isSelected,
    editText,
    setEditText,
    inputRef,
    startEdit,
    confirmEdit,
    cancelEdit,
    handleInputKeyDown,
    handleLabelClick,
    handleInsertLabelClick,
    handleRowKeyDown,
  };
}
