"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import type { FloatingAnchor } from "@/components/shared/FloatingPanel";
import type { Idea, IdeaStatus } from "@/lib/types";
import { applyStatusTransition } from "@/lib/tasks/statusTransition";

interface UseTimelineRowStateParams {
  task: Idea;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
}

/** Dismiss-on-scroll/resize subscription for one popup flag. */
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
 * Popup/edit UI state for one timeline task row. Trigger refs live in the
 * section components (the refs lint rule can't see through hook returns);
 * effects here are subscriptions only.
 */
export function useTimelineRowState({
  task,
  onUpdate,
  onDone,
  onUndone,
}: UseTimelineRowStateParams) {
  const [showMenu, setShowMenu] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [tagPickerPos, setTagPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [linkPanelPos, setLinkPanelPos] = useState<FloatingAnchor | null>(null);
  const [attachPos, setAttachPos] = useState<FloatingAnchor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  // Menu outside-click/scroll handling is owned by FloatingPanel. The
  // scroll effect below also closes the inline submenu expanders.
  useEffect(() => {
    if (!showMenu) return;
    const close = () => {
      setShowMenu(false);
      setShowAttachPanel(false);
      setShowLinkPanel(false);
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showMenu]);

  useDismissOnScrollResize(showStatusPicker, setShowStatusPicker);

  const handleStatusSelect = (status: IdeaStatus) => {
    applyStatusTransition(task.id, status, onUpdate, { onDone, onUndone });
    setShowStatusPicker(false);
  };

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

  return {
    showMenu,
    setShowMenu,
    showTagPicker,
    setShowTagPicker,
    showStatusPicker,
    setShowStatusPicker,
    showAttachPanel,
    setShowAttachPanel,
    showLinkPanel,
    setShowLinkPanel,
    isHovered,
    setIsHovered,
    menuPos,
    setMenuPos,
    showReveal,
    setShowReveal,
    revealPos,
    setRevealPos,
    statusPickerPos,
    setStatusPickerPos,
    tagPickerPos,
    setTagPickerPos,
    linkPanelPos,
    setLinkPanelPos,
    attachPos,
    setAttachPos,
    isEditing,
    editText,
    setEditText,
    handleStatusSelect,
    handleStartEdit,
    handleConfirmEdit,
    handleCancelEdit,
    handleKeyDown,
  };
}

export type TimelineRowState = ReturnType<typeof useTimelineRowState>;
