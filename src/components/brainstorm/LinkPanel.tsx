"use client";

import { useEffect, useRef, useState } from "react";
import { Idea, IdeaLink, LinkType } from "@/lib/types";

const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: "unblocks", label: "Unblocks" },
  { value: "contributes_to", label: "Contributes to" },
  { value: "depends_on", label: "Depends on" },
  { value: "related_to", label: "Related to" },
  { value: "part_of", label: "Part of" },
];

interface LinkPanelProps {
  ideaId: string;
  ideas: Idea[];
  links: IdeaLink[];
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onClose: () => void;
}

export function LinkPanel({
  ideaId,
  ideas,
  links,
  onCreateLink,
  onDeleteLink,
  onClose,
}: LinkPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<LinkType>("related_to");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const ideaLinks = links.filter(
    (l) => l.source_id === ideaId || l.target_id === ideaId
  );

  const linkedIds = new Set(
    ideaLinks.flatMap((l) => [l.source_id, l.target_id])
  );

  const searchResults = search.trim()
    ? ideas.filter(
        (i) =>
          i.id !== ideaId &&
          !linkedIds.has(i.id) &&
          i.text.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSelectIdea = async (targetId: string) => {
    await onCreateLink(ideaId, targetId, selectedType);
    setSearch("");
  };

  const getIdeaText = (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    return idea?.text || "Unknown";
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[280px] max-w-[340px]"
    >
      <div className="text-xs font-medium text-gray-500 mb-2">Link this idea</div>

      {/* Link type selector */}
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as LinkType)}
        className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md mb-2 bg-white"
      >
        {LINK_TYPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {/* Search input */}
      <input
        type="text"
        placeholder="Search ideas..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded-md mb-2 outline-none focus:border-indigo-500"
        autoFocus
      />

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-md mb-2 max-h-[150px] overflow-y-auto">
          {searchResults.map((idea) => (
            <button
              key={idea.id}
              onClick={() => handleSelectIdea(idea.id)}
              className="block w-full text-left text-sm px-2 py-1.5 hover:bg-indigo-50 truncate"
            >
              {idea.text}
            </button>
          ))}
        </div>
      )}

      {search.trim() && searchResults.length === 0 && (
        <p className="text-xs text-gray-400 italic mb-2">No matching ideas</p>
      )}

      {/* Existing links */}
      {ideaLinks.length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-1">
          <div className="text-xs text-gray-400 mb-1">Linked ({ideaLinks.length})</div>
          <div className="flex flex-wrap gap-1">
            {ideaLinks.map((link) => {
              const otherId = link.source_id === ideaId ? link.target_id : link.source_id;
              const direction = link.source_id === ideaId ? "→" : "←";
              return (
                <span
                  key={link.id}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                >
                  <span className="text-gray-400">{direction}</span>
                  <span className="truncate max-w-[120px]">{getIdeaText(otherId)}</span>
                  <span className="text-gray-400">({link.link_type.replace("_", " ")})</span>
                  <button
                    onClick={() => onDeleteLink(link.id)}
                    className="text-gray-400 hover:text-red-500 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
