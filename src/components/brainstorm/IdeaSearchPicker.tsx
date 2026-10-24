"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Idea, IdeaType, Tag } from "@/lib/types";
import { AREA_DOT_COLORS, STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { TYPE_COLORS } from "./ideaNodeSlots";
import { PARENT_TYPE_OPTIONS, hasExactMatch } from "@/lib/ideaParentType";

interface IdeaSearchPickerProps {
  ideas: Idea[];
  excludeIds?: Set<string>;
  placeholder?: string;
  emptyLabel?: string;
  getTagsForIdea?: (ideaId: string) => Tag[];
  renderActions: (idea: Idea, clearSearch: () => void) => ReactNode;
  excludeDone?: boolean;
  /** Prefill the search input. */
  initialQuery?: string;
  /** Hide the search field while still using `initialQuery` to filter results. */
  hideSearchInput?: boolean;
  /** When true, match when every whitespace-separated word is contained in idea text (not just substring). */
  matchAllWords?: boolean;
  /** Show a trailing "Create "<query>" as <type>" row when there's no exact match. */
  showCreateOption?: boolean;
  /** Pre-selected type for the create-row dropdown. */
  defaultCreateType?: IdeaType;
  /** Called with the trimmed query + chosen type when the create row is confirmed. */
  onCreateNew?: (text: string, type: IdeaType) => Promise<void>;
  /** Called with the raw input whenever it changes (e.g. to mirror the query elsewhere). */
  onSearchChange?: (query: string) => void;
  /**
   * When provided, the result title becomes a one-click action (and Enter
   * picks the highlighted result). The caller decides what picking means
   * (e.g. smart reveal). The eye/menu slot in `renderActions` stays for
   * explicit choices.
   */
  onPick?: (idea: Idea) => void;
  /** Called whenever the keyboard/mouse-highlighted result changes. */
  onActiveChange?: (idea: Idea | null) => void;
}

function getTypeLabel(type: IdeaType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const DONE_STATUSES: Idea["status"][] = ["completed", "cancelled", "missed", "archived"];

function formatScheduleLabel(idea: Idea): string | null {
  if (!idea.scheduled_date) return null;
  if (idea.scheduled_time) return `${idea.scheduled_date} · ${idea.scheduled_time.slice(0, 5)}`;
  return idea.scheduled_date;
}

function getPathLabel(idea: Idea, ideasById: Map<string, Idea>) {
  const segments: string[] = [];
  const visited = new Set<string>([idea.id]);
  let current: Idea | undefined = idea;
  while (current?.parent_id && !visited.has(current.parent_id)) {
    visited.add(current.parent_id);
    const parent = ideasById.get(current.parent_id);
    if (!parent) break;
    segments.unshift(parent.text || "empty");
    current = parent;
  }
  return segments.length > 0 ? segments.join(" › ") : "Root";
}

export function IdeaSearchPicker({
  ideas,
  excludeIds = new Set(),
  placeholder = "Search ideas...",
  emptyLabel = "No matching ideas",
  getTagsForIdea,
  renderActions,
  excludeDone = false,
  initialQuery,
  hideSearchInput = false,
  matchAllWords = false,
  showCreateOption = false,
  defaultCreateType = "project",
  onCreateNew,
  onSearchChange,
  onPick,
  onActiveChange,
}: IdeaSearchPickerProps) {
  const [search, setSearch] = useState(initialQuery ?? "");
  const [activeIndex, setActiveIndex] = useState(0);
  const [createType, setCreateType] = useState<IdeaType>(defaultCreateType);
  const [creating, setCreating] = useState(false);
  const ideasById = new Map(ideas.map((idea) => [idea.id, idea]));
  const query = search.trim().toLowerCase();
  const searchResults = query
    ? ideas
        .filter((idea) => {
          if (excludeIds.has(idea.id)) return false;
          if (excludeDone && DONE_STATUSES.includes(idea.status)) return false;
          if (matchAllWords) {
            const words = query.split(/\s+/).filter(Boolean);
            const text = idea.text.toLowerCase();
            return words.every((w) => text.includes(w));
          }
          return idea.text.toLowerCase().includes(query);
        })
        .slice(0, 8)
    : [];

  const trimmed = search.trim();
  const showCreateRow =
    showCreateOption && !!onCreateNew && trimmed.length > 0 && !hasExactMatch(ideas, trimmed);
  const active = Math.min(activeIndex, Math.max(searchResults.length - 1, 0));
  const activeIdea = searchResults[active] ?? null;

  useEffect(() => {
    onActiveChange?.(activeIdea);
  }, [activeIdea, onActiveChange]);

  const handleCreate = async () => {
    if (!onCreateNew || !trimmed || creating) return;
    setCreating(true);
    try {
      await onCreateNew(trimmed, createType);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {!hideSearchInput && (
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveIndex(0);
            onSearchChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && searchResults.length > 0) {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
              return;
            }
            if (e.key === "ArrowUp" && searchResults.length > 0) {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter") {
              if (searchResults.length > 0 && onPick) {
                e.preventDefault();
                onPick(searchResults[active]!);
                return;
              }
              if (showCreateRow) void handleCreate();
            }
          }}
          className="mb-2 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-violet-500/40 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500"
          autoFocus
        />
      )}

      {searchResults.length > 0 && (
        <div className="mb-2 max-h-[220px] overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
          {searchResults.map((idea, idx) => {
            const tags = getTagsForIdea?.(idea.id) ?? [];
            const isActive = !!onPick && idx === active;
            return (
              <div
                key={idea.id}
                onMouseEnter={() => {
                  if (onPick) setActiveIndex(idx);
                }}
                className={`flex items-start justify-between gap-2 px-2.5 py-2 ${isActive ? "bg-violet-50/70 dark:bg-violet-500/10" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"}`}
              >
                <div className="min-w-0 flex-1">
                  {onPick ? (
                    <button
                      onClick={() => onPick(idea)}
                      title="Open selected idea"
                      className="block w-full cursor-pointer text-left"
                    >
                      <p className="line-clamp-2 text-sm leading-snug break-words text-gray-800 hover:text-violet-700 dark:text-gray-200 dark:hover:text-violet-300">
                        {idea.text || "empty"}
                      </p>
                    </button>
                  ) : (
                    <p className="line-clamp-2 text-sm leading-snug break-words text-gray-800 dark:text-gray-200">
                      {idea.text || "empty"}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {idea.type && (
                      <span
                        className={`flex-shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${TYPE_COLORS[idea.type]}`}
                      >
                        {getTypeLabel(idea.type)}
                      </span>
                    )}
                    <span
                      className={`flex-shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium ${STATUS_STYLES[idea.status]}`}
                    >
                      {STATUS_LABELS[idea.status]}
                    </span>
                    {tags.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        {tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="flex items-center gap-1 rounded-full border border-current/20 px-1 py-px text-[10px]"
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
                            />
                            {tag.name}
                          </span>
                        ))}
                      </span>
                    )}
                    {formatScheduleLabel(idea) && (
                      <span className="flex-shrink-0 rounded border border-violet-200 bg-violet-50 px-1 py-px text-[10px] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300">
                        {formatScheduleLabel(idea)}
                      </span>
                    )}
                    <span className="truncate text-xs text-gray-400 dark:text-gray-500">
                      {getPathLabel(idea, ideasById)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {renderActions(idea, () => setSearch(""))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {search.trim() && searchResults.length === 0 && !showCreateRow && (
        <p className="mb-2 text-xs text-gray-400 italic dark:text-gray-500">{emptyLabel}</p>
      )}

      {showCreateRow && (
        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="mb-2 flex w-full flex-wrap items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-2.5 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-gray-200 dark:hover:bg-indigo-500/15"
        >
          <Plus size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="min-w-0 flex-1 leading-snug break-words">
            Create &ldquo;{trimmed}&rdquo; as{" "}
            <span onClick={(e) => e.stopPropagation()} className="inline-flex">
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value as IdeaType)}
                onClick={(e) => e.stopPropagation()}
                aria-label="New parent type"
                className="rounded-md border border-black/10 bg-white px-1 py-0.5 text-xs font-medium text-gray-700 outline-none dark:border-white/10 dark:bg-gray-800 dark:text-gray-200"
              >
                {PARENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {getTypeLabel(t)}
                  </option>
                ))}
              </select>
            </span>
          </span>
          {creating && <span className="text-xs text-gray-400">…</span>}
        </button>
      )}
    </>
  );
}
