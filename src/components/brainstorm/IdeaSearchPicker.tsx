"use client";

import { useState, type ReactNode } from "react";
import { Idea, IdeaType, Tag } from "@/lib/types";
import { AREA_DOT_COLORS, STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { TYPE_COLORS } from "./ideaNodeSlots";

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
  /** When true, match when every whitespace-separated word is contained in idea text (not just substring). */
  matchAllWords?: boolean;
}

function getTypeLabel(type: IdeaType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const DONE_STATUSES: Idea["status"][] = ["completed", "cancelled", "archived"];

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
  matchAllWords = false,
}: IdeaSearchPickerProps) {
  const [search, setSearch] = useState(initialQuery ?? "");
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

  return (
    <>
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-violet-500/40 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500"
        autoFocus
      />

      {searchResults.length > 0 && (
        <div className="mb-2 max-h-[220px] overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
          {searchResults.map((idea) => {
            const tags = getTagsForIdea?.(idea.id) ?? [];
            return (
              <div
                key={idea.id}
                className="flex items-start justify-between gap-2 px-2.5 py-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug break-words text-gray-800 dark:text-gray-200">
                    {idea.text || "empty"}
                  </p>
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

      {search.trim() && searchResults.length === 0 && (
        <p className="mb-2 text-xs text-gray-400 italic dark:text-gray-500">{emptyLabel}</p>
      )}
    </>
  );
}
