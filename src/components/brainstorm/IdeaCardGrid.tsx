"use client";

import { useMemo } from "react";
import { StickyNote } from "lucide-react";
import { Idea, IdeaNode, IdeaType } from "@/lib/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { filterIdeaTree } from "@/lib/ideaTreeFilters";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { TYPE_COLORS } from "./ideaNodeSlots";
import { useNotes } from "@/contexts/NotesContext";

function collectIds(nodes: IdeaNode[], acc: Set<string> = new Set<string>()): Set<string> {
  for (const node of nodes) {
    acc.add(node.id);
    collectIds(node.children, acc);
  }
  return acc;
}

function formatScheduleDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function IdeaCard({
  idea,
  isSelected,
  onSelect,
}: {
  idea: Idea;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { openNotes } = useNotes();
  const hasDetails = Boolean(idea.notes?.trim());

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={idea.text || "Untitled idea"}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(idea.id);
      }}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(idea.id);
        }
      }}
      className={`glass-card group rounded-xl p-3 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none dark:focus-visible:ring-indigo-500 ${
        isSelected ? "ring-2 ring-indigo-400 dark:ring-indigo-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`line-clamp-2 text-sm font-medium ${
            idea.status === "completed"
              ? "text-violet-600/70 line-through dark:text-violet-400/60"
              : "text-gray-800 dark:text-gray-100"
          }`}
        >
          {idea.text || <span className="text-gray-400 italic">Untitled</span>}
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLES[idea.status]}`}
        >
          {STATUS_LABELS[idea.status]}
        </span>
      </div>

      {idea.notes?.trim() && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openNotes(idea.id);
          }}
          className="mt-1 line-clamp-2 w-full text-left text-xs leading-relaxed whitespace-pre-wrap text-gray-500 italic hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          {idea.notes}
        </button>
      )}

      {(idea.type || idea.scheduled_date || hasDetails) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {idea.type && (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                TYPE_COLORS[idea.type as IdeaType]
              }`}
            >
              {idea.type.charAt(0).toUpperCase() + idea.type.slice(1)}
            </span>
          )}
          {idea.scheduled_date && (
            <span className="truncate rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
              {formatScheduleDate(idea.scheduled_date)}
            </span>
          )}
          <button
            type="button"
            aria-label={hasDetails ? "Edit notes" : "Add notes"}
            title={hasDetails ? "Edit notes" : "Add notes"}
            onClick={(e) => {
              e.stopPropagation();
              openNotes(idea.id);
            }}
            className={`flex items-center rounded p-0.5 ${
              hasDetails
                ? "text-indigo-400 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                : "text-gray-300 hover:bg-black/5 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-white/5"
            }`}
          >
            <StickyNote size={11} strokeWidth={hasDetails ? 2 : 1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

export function IdeaCardGrid({
  tree,
  ideas,
  search,
  hideClosed,
  hideCompleted,
  hideDeferred,
  focusedId,
  selectedId,
  onSelect,
}: {
  tree: IdeaNode[];
  ideas: Idea[];
  search: string;
  hideClosed: boolean;
  hideCompleted: boolean;
  hideDeferred: boolean;
  focusedId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const visibleIdeas = useMemo(() => {
    const filteredTree = filterIdeaTree(tree, ideas, {
      search,
      hideClosed,
      hideCompleted,
      hideDeferred,
    });
    let visibleIds = collectIds(filteredTree);
    if (focusedId) {
      const focusIds = getFocusedSubtreeIds(focusedId, ideas);
      visibleIds = new Set([...visibleIds].filter((id) => focusIds.has(id)));
    }
    return ideas.filter((idea) => visibleIds.has(idea.id));
  }, [tree, ideas, search, hideClosed, hideCompleted, hideDeferred, focusedId]);

  if (visibleIdeas.length === 0) {
    return (
      <p className="py-4 text-sm text-gray-400 italic">
        {focusedId
          ? "No ideas in this focus"
          : search
            ? "No matching ideas"
            : 'No ideas yet. Click "+ New idea" to start.'}
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      onClick={(e) => e.stopPropagation()}
    >
      {visibleIdeas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          isSelected={selectedId === idea.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
