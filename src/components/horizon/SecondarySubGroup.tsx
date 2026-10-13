"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { TaskComposer } from "@/components/shared/TaskComposer";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { usePickerPos } from "@/components/horizon/slots/HorizonRowSlots";
import { TYPE_BADGE } from "@/lib/constants";
import type { Idea, IdeaType } from "@/lib/types";
import type { TreeNode } from "@/components/tree";

export function SecondarySubGroup({
  lensKey,
  groupValue,
  secondaryKey,
  secondaryValue,
  label,
  nodes,
  renderRows,
  onAddSecondary,
  suggestFrom,
  muted = false,
}: {
  lensKey: string;
  groupValue: string | null;
  secondaryKey: string;
  secondaryValue: string | null;
  label: string;
  nodes: TreeNode<Idea>[];
  renderRows: (rows: TreeNode<Idea>[]) => React.ReactNode;
  onAddSecondary?: (text: string, type: IdeaType, secondaryValue: string | null) => Promise<void>;
  suggestFrom?: Idea[];
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group:${lensKey}:${groupValue ?? "null"}:${secondaryKey}:${secondaryValue ?? "null"}`,
  });
  const [draftType, setDraftType] = useState<IdeaType>("task");
  const {
    showPicker: showTypePicker,
    setShowPicker: setShowTypePicker,
    pickerPos: typePickerPos,
    openFromButton,
  } = usePickerPos();
  return (
    <div
      ref={setNodeRef}
      className={`mx-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06] ${isOver ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "bg-black/[0.015] dark:bg-white/[0.015]"}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase ${muted ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"}`}
        >
          {label}
        </span>
        <span className="rounded-full bg-black/[0.04] px-1.5 py-0 text-[10px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
          {nodes.length}
        </span>
      </div>
      {nodes.length > 0 ? (
        renderRows(nodes)
      ) : (
        <p className="px-3 pb-1 text-[11px] text-gray-400 italic dark:text-gray-500">
          Drop here or add below
        </p>
      )}
      {onAddSecondary && (
        <div className="flex items-center gap-1.5 border-t border-black/[0.04] px-3 py-1.5 dark:border-white/[0.06]">
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={openFromButton}
              className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${TYPE_BADGE[draftType].className} cursor-pointer transition-opacity hover:opacity-80`}
            >
              {TYPE_BADGE[draftType].label}
            </button>
            {showTypePicker && typePickerPos && (
              <TypePicker
                current={draftType}
                onSelect={(type) => {
                  setDraftType(type ?? "task");
                  setShowTypePicker(false);
                }}
                onClose={() => setShowTypePicker(false)}
                position={typePickerPos}
              />
            )}
          </div>
          <QuickAddInline
            secondaryValue={secondaryValue}
            draftType={draftType}
            onAdd={onAddSecondary}
            suggestFrom={suggestFrom}
          />
        </div>
      )}
    </div>
  );
}

function QuickAddInline({
  secondaryValue,
  draftType,
  onAdd,
  suggestFrom,
}: {
  secondaryValue: string | null;
  draftType: IdeaType;
  onAdd: (text: string, type: IdeaType, secondaryValue: string | null) => Promise<void>;
  suggestFrom?: Idea[];
}) {
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <TaskComposer
        variant="plain"
        placeholder="+ Add..."
        onCreate={(trimmed) => onAdd(trimmed, draftType, secondaryValue)}
        suggestFrom={suggestFrom}
      />
    </div>
  );
}
