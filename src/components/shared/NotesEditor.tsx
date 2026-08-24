"use client";

import { StickyNote } from "lucide-react";
import { DetailField } from "@/components/brainstorm/IdeaDetailField";

export function NotesEditor({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string | null) => void;
}) {
  return (
    <DetailField
      icon={StickyNote}
      value={value}
      placeholder="Add notes…"
      multiline
      onSave={onSave}
    />
  );
}
