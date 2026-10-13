"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import type { Idea, IdeaStatus, Tag } from "@/lib/types";
import { applyStatusTransition } from "@/lib/tasks/statusTransition";

interface UsePlannerRowStateParams {
  task: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
}

/** Closes a popup on scroll/resize while it is open. */
function useDismissOnScrollResize(active: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (!active) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [active, setOpen]);
}

/**
 * All popup/edit UI state for one planner task row: open flags, anchor
 * positions, trigger refs, inline editing, and the shared dismiss effects.
 * Effect bodies only subscribe; setState runs in event callbacks.
 */
export function usePlannerRowState({
  task,
  onUpdate,
  onDone,
  onUndone,
  onAddTag,
}: UsePlannerRowStateParams) {
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState(task.duration_minutes?.toString() ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [durationPos, setDurationPos] = useState<{ top: number; left: number } | null>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [timeMenuPos, setTimeMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [attachPos, setAttachPos] = useState<{ top: number; left: number } | null>(null);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [linkPanelPos, setLinkPanelPos] = useState<{ top: number; left: number } | null>(null);

  useDismissOnScrollResize(showMenu, setShowMenu);
  useDismissOnScrollResize(showStatusPicker, setShowStatusPicker);
  useDismissOnScrollResize(showAreaPicker, setShowAreaPicker);
  useDismissOnScrollResize(showTimeMenu, setShowTimeMenu);

  const handleStartEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    if (editText.trim() && editText.trim() !== task.text) {
      onUpdate(task.id, { text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleStatusSelect = (status: IdeaStatus) => {
    applyStatusTransition(task.id, status, onUpdate, { onDone, onUndone });
    setShowStatusPicker(false);
  };

  const handleTagSelected = async (tag: Tag) => {
    if (onAddTag) {
      await onAddTag(task.id, tag);
    }
    setShowAreaPicker(false);
  };

  return {
    showMenu,
    setShowMenu,
    showAreaPicker,
    setShowAreaPicker,
    showStatusPicker,
    setShowStatusPicker,
    statusPickerPos,
    setStatusPickerPos,
    showDurationDropdown,
    setShowDurationDropdown,
    showCustomInput,
    setShowCustomInput,
    customVal,
    setCustomVal,
    isEditing,
    editText,
    setEditText,
    menuPos,
    setMenuPos,
    durationPos,
    setDurationPos,
    areaPickerPos,
    setAreaPickerPos,
    showTimeMenu,
    setShowTimeMenu,
    timeMenuPos,
    setTimeMenuPos,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showAttachPanel,
    setShowAttachPanel,
    attachPos,
    setAttachPos,
    revealPos,
    setRevealPos,
    showReveal,
    setShowReveal,
    showLinkPanel,
    setShowLinkPanel,
    linkPanelPos,
    setLinkPanelPos,
    handleStartEdit,
    handleConfirmEdit,
    handleCancelEdit,
    handleKeyDown,
    handleStatusSelect,
    handleTagSelected,
  };
}

export type PlannerRowState = ReturnType<typeof usePlannerRowState>;
