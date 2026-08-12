"use client";

import { useEffect, useRef } from "react";
import { Idea } from "@/lib/types";
import { IdeaSearchPicker } from "./IdeaSearchPicker";

interface MoveIdeaPanelProps {
  idea: Idea;
  ideas: Idea[];
  onMove: (newParentId: string | null, newSortOrder: number) => Promise<void>;
  onMoved: (parentIdToExpand: string | null) => void;
  onClose: () => void;
}

function getDescendantIds(ideaId: string, ideas: Idea[]) {
  const descendants = new Set<string>();
  const collect = (parentId: string) => {
    for (const child of ideas.filter((idea) => idea.parent_id === parentId)) {
      descendants.add(child.id);
      collect(child.id);
    }
  };
  collect(ideaId);
  return descendants;
}

export function MoveIdeaPanel({ idea, ideas, onMove, onMoved, onClose }: MoveIdeaPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const excludedIds = getDescendantIds(idea.id, ideas);
  excludedIds.add(idea.id);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const moveBelow = async (target: Idea) => {
    await onMove(target.parent_id, target.sort_order + 1);
    onMoved(null);
    onClose();
  };

  const moveAsChild = async (target: Idea) => {
    await onMove(target.id, 0);
    onMoved(target.id);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="glass-card-strong absolute top-full right-0 z-50 mt-1 max-w-[420px] min-w-[340px] rounded-xl p-3"
    >
      <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        Move this idea
      </div>
      <IdeaSearchPicker
        ideas={ideas}
        excludeIds={excludedIds}
        emptyLabel="No valid ideas"
        renderActions={(target) => (
          <>
            <button
              onClick={() => moveBelow(target)}
              className="rounded-lg border border-black/10 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
            >
              Below
            </button>
            <button
              onClick={() => moveAsChild(target)}
              className="rounded-lg border border-black/10 px-2 py-1 text-xs text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
            >
              As child
            </button>
          </>
        )}
      />
    </div>
  );
}
