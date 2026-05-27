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
        className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md mb-2 outline-none focus:border-indigo-500"
        autoFocus
      />

      {searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-md mb-2 max-h-[190px] overflow-y-auto">
          {searchResults.map((idea) => (
            <div
              key={idea.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 truncate">{idea.text || "empty"}</div>
              <div className="text-xs text-gray-400 truncate">
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
        <p className="text-xs text-gray-400 italic mb-2">{emptyLabel}</p>
      )}
    </>
  );
}
