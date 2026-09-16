"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { LifeArea, Tag } from "@/lib/types";
import { AREA_LABELS } from "@/lib/constants";
import { minutesToTimeString } from "./dayslotAdapter";
import { TagPicker } from "@/components/shared/TagPicker";

export function SlotForm({
  startMinute,
  close,
  onCreateTask,
  defaultArea,
  tags,
  onCreateTag,
}: {
  startMinute: number;
  close: () => void;
  onCreateTask: (text: string, time: string, area?: LifeArea, tag?: Tag) => Promise<void>;
  defaultArea: LifeArea | null;
  tags: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [text, setText] = useState("");
  const [selectedArea, setSelectedArea] = useState<LifeArea | null>(defaultArea);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const areaBtnRef = useRef<HTMLButtonElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const submittingRef = useRef(false);

  const timeStr = minutesToTimeString(startMinute);

  const systemTags = useMemo(() => tags.filter((t) => t.is_system), [tags]);
  const areaSystemTag = useMemo(
    () => systemTags.find((t) => t.area === (selectedArea || "life")),
    [systemTags, selectedArea],
  );

  const handleAdd = async () => {
    if (!text.trim() || submittingRef.current) return;
    submittingRef.current = true;
    close();
    try {
      await onCreateTask(text.trim(), timeStr, selectedArea ?? undefined, selectedTag ?? undefined);
    } catch (err) {
      console.error("Failed to create scheduled task", err);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl border border-black/5 bg-white p-2 dark:border-white/10 dark:bg-gray-900">
      <input
        type="text"
        placeholder={`Add task at ${timeStr}...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) void handleAdd();
          if (e.key === "Escape") close();
        }}
        className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/20 dark:bg-gray-800 dark:text-gray-200"
        autoFocus
      />
      <div className="flex items-center justify-between gap-2">
        <button
          ref={areaBtnRef}
          onClick={() => {
            if (showAreaPicker) {
              setShowAreaPicker(false);
              return;
            }
            const rect = areaBtnRef.current?.getBoundingClientRect();
            if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowAreaPicker(true);
          }}
          className="cursor-pointer rounded-full border border-black/10 px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Area: {selectedTag ? selectedTag.name : selectedArea ? AREA_LABELS[selectedArea] : "Life"}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={close}
            className="cursor-pointer px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAdd()}
            className="cursor-pointer rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
          >
            Add
          </button>
        </div>
      </div>
      {showAreaPicker &&
        areaPickerPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: areaPickerPos.top,
              left: areaPickerPos.left,
              zIndex: 10000,
            }}
          >
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
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
