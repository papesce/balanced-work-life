"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Check } from "lucide-react";
import { Tag, LifeArea } from "@/lib/types";
import { AREA_ORDER, AREA_LABELS } from "@/components/planner/constants";

const AREA_COLORS: Record<LifeArea, string> = {
  work: "text-blue-700 dark:text-blue-300",
  health: "text-red-700 dark:text-red-300",
  relationships: "text-pink-700 dark:text-pink-300",
  growth: "text-amber-700 dark:text-amber-300",
  finances: "text-emerald-700 dark:text-emerald-300",
  life: "text-green-700 dark:text-green-300",
};

export const AREA_DOT_COLORS: Record<LifeArea, string> = {
  work: "bg-blue-500",
  health: "bg-red-500",
  relationships: "bg-pink-500",
  growth: "bg-amber-500",
  finances: "bg-emerald-500",
  life: "bg-green-500",
};

interface TagPickerProps {
  allTags: Tag[];
  selectedTags: Tag[];
  onAdd: (tag: Tag) => void;
  onRemove: (tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onClose: () => void;
}

export function TagPicker({
  allTags,
  selectedTags,
  onAdd,
  onRemove,
  onCreateTag,
  onClose,
}: TagPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState<LifeArea>("life");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const handleToggle = useCallback(
    (tag: Tag) => {
      if (selectedIds.has(tag.id)) {
        onRemove(tag.id);
      } else {
        onAdd(tag);
      }
    },
    [selectedIds, onAdd, onRemove]
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const tag = await onCreateTag(name, newArea);
    if (tag) {
      onAdd(tag);
      setNewName("");
      setCreating(false);
    }
  };

  // Group tags by area
  const tagsByArea = AREA_ORDER.reduce<Record<LifeArea, Tag[]>>((acc, area) => {
    acc[area] = allTags.filter((t) => t.area === area);
    return acc;
  }, {} as Record<LifeArea, Tag[]>);

  const areasWithTags = AREA_ORDER.filter((a) => tagsByArea[a].length > 0);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 glass-card-strong rounded-xl shadow-lg min-w-[200px] max-w-[260px] py-2"
    >
      {areasWithTags.length === 0 && !creating && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">No tags yet</p>
      )}

      {areasWithTags.map((area) => (
        <div key={area}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-0.5 ${AREA_COLORS[area]}`}>
            {AREA_LABELS[area]}
          </p>
          {tagsByArea[area].map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleToggle(tag)}
              className="flex items-center gap-2 w-full text-left text-sm px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            >
              <span className={`flex-none w-3.5 h-3.5 rounded border flex items-center justify-center ${
                selectedIds.has(tag.id)
                  ? "bg-current border-current"
                  : "border-gray-300 dark:border-gray-600"
              }`}>
                {selectedIds.has(tag.id) && <Check size={9} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-gray-700 dark:text-gray-200">{tag.name}</span>
            </button>
          ))}
        </div>
      ))}

      {creating ? (
        <div className="px-3 pt-2 pb-1 border-t border-black/5 dark:border-white/5 mt-1 space-y-1.5">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Tag name…"
            className="w-full text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 outline-none focus:border-gray-400 dark:focus:border-gray-500"
          />
          <div className="flex flex-wrap gap-1">
            {AREA_ORDER.map((area) => (
              <button
                key={area}
                onClick={() => setNewArea(area)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  newArea === area
                    ? `${AREA_COLORS[area]} border-current font-medium`
                    : "text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700"
                }`}
              >
                {AREA_LABELS[area]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={() => void handleCreate()}
              className="text-xs px-2 py-0.5 rounded bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium"
            >
              Add
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-xs px-2 py-0.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 w-full text-left text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 border-t border-black/5 dark:border-white/5 mt-1"
        >
          <Plus size={12} />
          New tag
        </button>
      )}
    </div>
  );
}
