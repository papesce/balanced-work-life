"use client";

import { useState, type ReactNode } from "react";
import { Idea } from "@/lib/types";

interface IdeaSearchPickerProps {
  ideas: Idea[];
  excludeIds?: Set<string>;
  placeholder?: string;
  emptyLabel?: string;
  renderActions: (idea: Idea, clearSearch: () => void) => ReactNode;
}

function getParentLabel(idea: Idea, ideasById: Map<string, Idea>) {
  if (!idea.parent_id) return "Root";
  return ideasById.get(idea.parent_id)?.text || "Unknown parent";
}

export function IdeaSearchPicker({
  ideas,
  excludeIds = new Set(),
  placeholder = "Search ideas...",
  emptyLabel = "No matching ideas",
  renderActions,
}: IdeaSearchPickerProps) {
  const [search, setSearch] = useState("");
  const ideasById = new Map(ideas.map((idea) => [idea.id, idea]));
  const query = search.trim().toLowerCase();
  const searchResults = query
    ? ideas
        .filter((idea) => !excludeIds.has(idea.id) && idea.text.toLowerCase().includes(query))
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
        <div className="mb-2 max-h-[190px] overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
          {searchResults.map((idea) => (
            <div
              key={idea.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-gray-800 dark:text-gray-200">
                  {idea.text || "empty"}
                </div>
                <div className="truncate text-xs text-gray-400 dark:text-gray-500">
                  {getParentLabel(idea, ideasById)}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                {renderActions(idea, () => setSearch(""))}
              </div>
            </div>
          ))}
        </div>
      )}

      {search.trim() && searchResults.length === 0 && (
        <p className="mb-2 text-xs text-gray-400 italic dark:text-gray-500">{emptyLabel}</p>
      )}
    </>
  );
}
