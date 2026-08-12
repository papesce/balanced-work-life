"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { Idea, IdeaLink, LinkType } from "@/lib/types";
import { IdeaSearchPicker } from "./IdeaSearchPicker";

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
  const [selectedType, setSelectedType] = useState<LinkType>("related_to");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const ideaLinks = links.filter((l) => l.source_id === ideaId || l.target_id === ideaId);

  const linkedIds = new Set(ideaLinks.flatMap((l) => [l.source_id, l.target_id]));

  linkedIds.add(ideaId);

  const handleSelectIdea = async (targetId: string) => {
    await onCreateLink(ideaId, targetId, selectedType);
  };

  const getIdeaText = (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    return idea?.text || "Unknown";
  };

  return (
    <div
      ref={ref}
      className="glass-card-strong absolute top-full left-0 z-50 mt-1 max-w-[340px] min-w-[280px] rounded-xl p-3"
    >
      <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        Link this idea
      </div>

      {/* Link type selector */}
      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as LinkType)}
        className="mb-2 w-full rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-sm text-gray-800 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200"
      >
        {LINK_TYPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <IdeaSearchPicker
        ideas={ideas}
        excludeIds={linkedIds}
        renderActions={(idea, clearSearch) => (
          <button
            onClick={async () => {
              await handleSelectIdea(idea.id);
              clearSearch();
            }}
            className="rounded-lg border border-black/10 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
          >
            Link
          </button>
        )}
      />

      {/* Existing links */}
      {ideaLinks.length > 0 && (
        <div className="mt-1 border-t border-black/5 pt-2 dark:border-white/5">
          <div className="mb-1 text-xs text-gray-400 dark:text-gray-500">
            Linked ({ideaLinks.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {ideaLinks.map((link) => {
              const otherId = link.source_id === ideaId ? link.target_id : link.source_id;
              const DirectionIcon = link.source_id === ideaId ? ArrowRight : ArrowLeft;
              return (
                <span
                  key={link.id}
                  className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-gray-700 dark:bg-white/[0.06] dark:text-gray-300"
                >
                  <DirectionIcon
                    size={10}
                    strokeWidth={2}
                    className="text-gray-400 dark:text-gray-500"
                  />
                  <span className="max-w-[120px] truncate">{getIdeaText(otherId)}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    ({link.link_type.replace("_", " ")})
                  </span>
                  <button
                    onClick={() => onDeleteLink(link.id)}
                    className="ml-0.5 text-gray-400 hover:text-red-500 dark:text-gray-500"
                  >
                    <X size={12} strokeWidth={2} />
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
