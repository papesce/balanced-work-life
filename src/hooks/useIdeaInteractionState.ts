"use client";

import { useState } from "react";

export function useIdeaInteractionState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTagPickerFor, setShowTagPickerFor] = useState<string | null>(null);
  const [showStatusPickerFor, setShowStatusPickerFor] = useState<string | null>(null);

  return {
    editingId,
    setEditingId,
    showTagPickerFor,
    setShowTagPickerFor,
    showStatusPickerFor,
    setShowStatusPickerFor,
  };
}
