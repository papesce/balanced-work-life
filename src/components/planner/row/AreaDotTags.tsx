"use client";

import { useRef } from "react";
import { TagPicker } from "@/components/shared/TagPicker";
import type { PlannerRowState } from "@/hooks/usePlannerRowState";
import type { Idea, LifeArea, Tag } from "@/lib/types";
import { areaColors } from "@/styles/tokens";

export function AreaDotTags({
  task,
  area,
  taskTags,
  allTags,
  ui,
  onRemoveTag,
  onCreateTag,
}: {
  task: Idea;
  area: LifeArea;
  taskTags: Tag[];
  allTags?: Tag[];
  ui: PlannerRowState;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const dotRef = useRef<HTMLButtonElement>(null);
  const nonSystemTags = taskTags.filter((t) => !t.is_system);
  return (
    <>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          ref={dotRef}
          onClick={(e) => {
            e.stopPropagation();
            if (ui.showAreaPicker) {
              ui.setShowAreaPicker(false);
              return;
            }
            const rect = dotRef.current?.getBoundingClientRect();
            if (rect) ui.setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
            ui.setShowAreaPicker(true);
          }}
          className="h-2 w-2 flex-shrink-0 cursor-pointer rounded-full transition-transform hover:scale-150"
          style={{ background: areaColors[area]?.dot }}
          title="Change area"
        />
        {nonSystemTags.map((tag) => (
          <span
            key={tag.id}
            className="flex-shrink-0 rounded-full px-1 py-0.5 text-[9px] font-bold"
            style={{
              background: `${areaColors[tag.area]?.dot}15`,
              color: areaColors[tag.area]?.dot,
            }}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {ui.showAreaPicker && ui.areaPickerPos && (
        <TagPicker
          allTags={allTags ?? []}
          selectedTags={taskTags}
          onAdd={ui.handleTagSelected}
          onRemove={async (tagId) => {
            if (onRemoveTag) await onRemoveTag(task.id, tagId);
            ui.setShowAreaPicker(false);
          }}
          onCreateTag={onCreateTag ?? (async () => null)}
          onClose={() => ui.setShowAreaPicker(false)}
          fixedPosition={ui.areaPickerPos}
        />
      )}
    </>
  );
}
