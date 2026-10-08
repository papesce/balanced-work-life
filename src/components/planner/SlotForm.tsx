"use client";

import { useState, useMemo } from "react";
import { Idea, LifeArea, Tag } from "@/lib/types";
import { AREA_LABELS } from "@/lib/constants";
import { minutesToTimeString } from "./dayslotAdapter";
import { TagPicker } from "@/components/shared/TagPicker";
import { TaskComposer } from "@/components/shared/TaskComposer";

export function SlotForm({
  startMinute,
  close,
  onCreateTask,
  defaultArea,
  tags,
  onCreateTag,
  suggestFrom,
}: {
  startMinute: number;
  close: () => void;
  onCreateTask: (text: string, time: string, area?: LifeArea, tag?: Tag) => Promise<void>;
  defaultArea: LifeArea | null;
  tags: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  suggestFrom?: Idea[];
}) {
  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(defaultArea);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [areaBtnRef, setAreaBtnRef] = useState<HTMLButtonElement | null>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);

  const timeStr = minutesToTimeString(startMinute);

  const systemTags = useMemo(() => tags.filter((t) => t.is_system), [tags]);
  const areaSystemTag = useMemo(
    () => systemTags.find((t) => t.area === (selectedArea || "life")),
    [systemTags, selectedArea],
  );

  const handleAdd = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    close();
    try {
      await onCreateTask(trimmed, timeStr, selectedArea ?? undefined, selectedTag ?? undefined);
    } catch (err) {
      console.error("Failed to create scheduled task", err);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-black/5 bg-white p-2 dark:border-white/10 dark:bg-gray-900">
      <TaskComposer
        variant="plain"
        autoFocus
        placeholder={`Add task at ${timeStr}...`}
        inputClassName="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/20 dark:bg-gray-800 dark:text-gray-200"
        onCreate={handleAdd}
        onDismiss={close}
        suggestFrom={suggestFrom}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          ref={setAreaBtnRef}
          onClick={() => {
            if (showAreaPicker) {
              setShowAreaPicker(false);
              return;
            }
            const rect = areaBtnRef?.getBoundingClientRect();
            if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowAreaPicker(true);
          }}
          className="cursor-pointer rounded-full border border-black/10 px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Area: {selectedTag ? selectedTag.name : selectedArea ? AREA_LABELS[selectedArea] : "Life"}
        </button>
        <div className="flex items-center gap-2">
          <span className="px-1 text-[10px] text-gray-400">Enter to add · Esc to close</span>
          <button
            onClick={close}
            className="cursor-pointer px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
      {showAreaPicker && areaPickerPos && (
        <TagPicker
          allTags={tags}
          selectedTags={areaSystemTag ? [areaSystemTag] : []}
          onAdd={(tag) => {
            setSelectedArea(tag.area);
            setSelectedTag(tag);
            setShowAreaPicker(false);
          }}
          onRemove={() => {}}
          onCreateTag={onCreateTag ?? (async () => null)}
          onClose={() => setShowAreaPicker(false)}
          singleSelect
          fixedPosition={areaPickerPos}
        />
      )}
    </div>
  );
}
