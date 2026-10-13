"use client";

import { useRef } from "react";
import { TagPicker } from "@/components/shared/TagPicker";
import type { TimelineRowState } from "@/hooks/useTimelineRowState";
import { AREA_DOT_COLORS } from "@/lib/constants";
import type { Idea, LifeArea, Tag } from "@/lib/types";

export function TagCluster({
  task,
  taskTags,
  allTags,
  ui,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  task: Idea;
  taskTags: Tag[];
  allTags: Tag[];
  ui: TimelineRowState;
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative flex flex-shrink-0 items-center gap-1">
      {taskTags.map((tag) => (
        <span
          key={tag.id}
          className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ opacity: 0.85 }}
        >
          <span
            className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
          />
          {tag.name}
        </span>
      ))}
      <button
        ref={tagTriggerRef}
        onClick={() => {
          if (ui.showTagPicker) {
            ui.setShowTagPicker(false);
            return;
          }
          const rect = tagTriggerRef.current?.getBoundingClientRect();
          if (rect) ui.setTagPickerPos({ top: rect.bottom + 4, left: rect.left });
          ui.setShowTagPicker(true);
        }}
        className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-gray-400 hover:bg-black/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10"
      >
        {taskTags.length === 0 ? "tag" : "+"}
      </button>
      {ui.showTagPicker && ui.tagPickerPos && (
        <TagPicker
          allTags={allTags}
          selectedTags={taskTags}
          onAdd={(tag) => {
            void onAddTag(task.id, tag);
          }}
          onRemove={(tagId) => {
            void onRemoveTag(task.id, tagId);
          }}
          onCreateTag={onCreateTag}
          onClose={() => ui.setShowTagPicker(false)}
          fixedPosition={ui.tagPickerPos}
        />
      )}
    </div>
  );
}
