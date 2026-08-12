"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Check } from "lucide-react";
import { Tag, LifeArea } from "@/lib/types";
import { AREA_LABELS, AREA_ORDER, AREA_TEXT_COLORS } from "@/lib/constants";
import { areaColors } from "@/styles/tokens";

function areaBg(area: LifeArea, opacity: number): string {
  const base = areaColors[area]?.bg ?? "rgba(0,0,0,0)";
  return base.replace(/[\d.]+\)$/, `${opacity})`);
}

interface TagPickerProps {
  allTags: Tag[];
  selectedTags: Tag[];
  onAdd: (tag: Tag) => void;
  onRemove: (tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  onClose: () => void;
  /** When set, renders in a fixed-position portal so the menu paints above everything. */
  fixedPosition?: { top: number; left: number };
  /** When set, only one tag can be selected: renders radios and clicking a new tag is exclusive (parent clears the rest). */
  singleSelect?: boolean;
}

export function TagPicker({
  allTags,
  selectedTags,
  onAdd,
  onRemove,
  onCreateTag,
  onClose,
  fixedPosition,
  singleSelect = false,
}: TagPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState<LifeArea>("life");
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!fixedPosition) return;
    const close = () => onClose();
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [fixedPosition, onClose]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const handleToggle = useCallback(
    (tag: Tag) => {
      if (selectedIds.has(tag.id)) {
        if (singleSelect) return;
        if (selectedTags.length <= 1) return;
        onRemove(tag.id);
      } else {
        onAdd(tag);
        onClose();
      }
    },
    [selectedIds, selectedTags, onAdd, onRemove, onClose, singleSelect],
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

  // Group tags by area, system tags first
  const tagsByArea = AREA_ORDER.reduce<Record<LifeArea, Tag[]>>(
    (acc, area) => {
      const tags = allTags.filter((t) => t.area === area);
      acc[area] = [...tags.filter((t) => t.is_system), ...tags.filter((t) => !t.is_system)];
      return acc;
    },
    {} as Record<LifeArea, Tag[]>,
  );

  const areasWithTags = AREA_ORDER.filter((a) => tagsByArea[a].length > 0);

  const content = (
    <div
      ref={ref}
      className={`${fixedPosition ? "fixed z-[9999]" : "absolute top-full left-0 z-50 mt-1"} glass-card-strong max-w-[260px] min-w-[200px] rounded-xl py-2 shadow-lg`}
      style={fixedPosition ? { top: fixedPosition.top, left: fixedPosition.left } : undefined}
    >
      {areasWithTags.length === 0 && !creating && (
        <p className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">No tags yet</p>
      )}

      {areasWithTags.map((area, areaIdx) => (
        <div key={area} className={areaIdx > 0 ? "mt-1.5" : ""}>
          {tagsByArea[area].map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleToggle(tag)}
              onMouseEnter={() => setHoveredTagId(tag.id)}
              onMouseLeave={() => setHoveredTagId(null)}
              className="mx-1 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
              title={
                selectedIds.has(tag.id) && selectedTags.length === 1
                  ? "A task must keep at least one area/tag"
                  : undefined
              }
              style={{
                width: "calc(100% - 8px)",
                background: areaBg(area, hoveredTagId === tag.id ? 0.24 : 0.12),
              }}
            >
              <span
                className={`flex h-3.5 w-3.5 flex-none items-center justify-center ${
                  singleSelect
                    ? "rounded-full border-2 " +
                      (selectedIds.has(tag.id)
                        ? "border-current ring-2 ring-current ring-inset"
                        : "border-gray-300 dark:border-gray-600")
                    : "rounded border " +
                      (selectedIds.has(tag.id)
                        ? "border-current bg-current"
                        : "border-gray-300 dark:border-gray-600")
                }`}
              >
                {!singleSelect && selectedIds.has(tag.id) && (
                  <Check size={9} className="text-white" strokeWidth={3} />
                )}
              </span>
              <span className="text-gray-700 dark:text-gray-200">{tag.name}</span>
            </button>
          ))}
        </div>
      ))}

      {creating ? (
        <div className="mt-1 space-y-1.5 border-t border-black/5 px-3 pt-2 pb-1 dark:border-white/5">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Tag name…"
            className="w-full rounded-md border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-gray-400 dark:border-gray-700 dark:focus:border-gray-500"
          />
          <div className="flex flex-wrap gap-1">
            {AREA_ORDER.map((area) => (
              <button
                key={area}
                onClick={() => setNewArea(area)}
                className={`cursor-pointer rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                  newArea === area
                    ? `${AREA_TEXT_COLORS[area]} border-current font-medium`
                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {AREA_LABELS[area]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <button
              onClick={() => void handleCreate()}
              className="cursor-pointer rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-gray-900"
            >
              Add
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1 flex w-full cursor-pointer items-center gap-1.5 border-t border-black/5 px-3 py-1.5 text-left text-xs text-gray-400 transition-colors hover:text-gray-600 dark:border-white/5 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <Plus size={12} />
          New tag
        </button>
      )}
    </div>
  );

  return fixedPosition ? createPortal(content, document.body) : content;
}
