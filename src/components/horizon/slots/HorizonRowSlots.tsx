"use client";

import { useState } from "react";
import { PriorityChip, type PriorityValue } from "@/components/shared/PriorityChip";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { TagPicker } from "@/components/shared/TagPicker";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { STATUS_LABELS, STATUS_STYLES, TYPE_BADGE } from "@/lib/constants";
import { computeStatusUpdates } from "@/lib/tasks/statusTransition";
import type {
  Idea,
  IdeaNode as IdeaNodeType,
  IdeaStatus,
  IdeaType,
  LifeArea,
  Tag,
} from "@/lib/types";

/** Shared anchor-picker pattern: button toggles a floating picker below it. */
export function usePickerPos() {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const openFromButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 4, left: rect.left });
    setShowPicker(!showPicker);
  };
  return { showPicker, setShowPicker, pickerPos, openFromButton };
}

export function PriorityChipSlot({
  node,
  priorityValueOf,
  onSetPriority,
}: {
  node: IdeaNodeType;
  priorityValueOf: (ideaId: string) => PriorityValue;
  onSetPriority: (ideaId: string, value: string | null) => Promise<void>;
}) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex flex-shrink-0 items-center">
      <PriorityChip
        value={priorityValueOf(node.id)}
        onSelect={(v) => void onSetPriority(node.id, v)}
        usePortal
      />
    </span>
  );
}

export function TypeBadgeSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const { showPicker, setShowPicker, pickerPos, openFromButton } = usePickerPos();
  const badge = node.type ? TYPE_BADGE[node.type] : null;
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={openFromButton}
        className={
          badge
            ? `rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`
            : "rounded-full px-1.5 py-0 text-[10px] font-semibold text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
        }
      >
        {badge?.label ?? "Type"}
      </button>
      {showPicker && pickerPos && (
        <TypePicker
          current={node.type}
          onSelect={(type) => {
            void onUpdate(node.id, { type });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
        />
      )}
    </div>
  );
}

export function HorizonTagsSlot({
  node,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  node: IdeaNodeType;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => void;
  onRemoveTag: (ideaId: string, tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const { showPicker, setShowPicker, pickerPos, openFromButton } = usePickerPos();
  const nodeTags = getTagsForIdea(node.id);
  return (
    <>
      {nodeTags.length > 0 && (
        <div className="flex flex-shrink-0 gap-0.5">
          {nodeTags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-black/[0.04] px-1.5 py-0 text-[10px] text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
            >
              {tag.name}
            </span>
          ))}
          {nodeTags.length > 2 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              +{nodeTags.length - 2}
            </span>
          )}
        </div>
      )}
      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={openFromButton}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
          title="Tags"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </button>
        {showPicker && pickerPos && (
          <TagPicker
            allTags={allTags}
            selectedTags={nodeTags}
            onAdd={(tag) => onAddTag(node.id, tag)}
            onRemove={(tagId) => onRemoveTag(node.id, tagId)}
            onCreateTag={onCreateTag}
            onClose={() => setShowPicker(false)}
            fixedPosition={pickerPos}
          />
        )}
      </div>
    </>
  );
}

export function StatusChipSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const { showPicker, setShowPicker, pickerPos, openFromButton } = usePickerPos();

  const handleStatusSelect = (status: IdeaStatus) => {
    void onUpdate(node.id, computeStatusUpdates(status));
    setShowPicker(false);
  };

  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={openFromButton}
        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${STATUS_STYLES[node.status]}`}
      >
        {STATUS_LABELS[node.status]}
      </button>
      {showPicker && pickerPos && (
        <StatusPicker
          current={node.status}
          onSelect={handleStatusSelect}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
        />
      )}
    </div>
  );
}

export function ComposingTypePill({
  initialType,
  onSelect,
}: {
  initialType: IdeaType;
  onSelect: (type: IdeaType) => void;
}) {
  const [type, setType] = useState<IdeaType>(initialType);
  const { showPicker, setShowPicker, pickerPos, openFromButton } = usePickerPos();
  const badge = TYPE_BADGE[type];
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={openFromButton}
        className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge?.className ?? ""} cursor-pointer transition-opacity hover:opacity-80`}
      >
        {badge?.label ?? "Task"}
      </button>
      {showPicker && pickerPos && (
        <TypePicker
          current={type}
          onSelect={(next) => {
            const chosen = next ?? "task";
            setType(chosen);
            onSelect(chosen);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
        />
      )}
    </div>
  );
}
