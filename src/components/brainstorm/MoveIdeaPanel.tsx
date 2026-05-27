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

export function MoveIdeaPanel({
  idea,
  ideas,
  onMove,
  onMoved,
  onClose,
}: MoveIdeaPanelProps) {
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
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[340px] max-w-[420px]"
    >
      <div className="text-xs font-medium text-gray-500 mb-2">Move this idea</div>
      <IdeaSearchPicker
        ideas={ideas}
        excludeIds={excludedIds}
        emptyLabel="No valid ideas"
        renderActions={(target) => (
          <>
            <button
              onClick={() => moveBelow(target)}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50"
            >
              Below
            </button>
            <button
              onClick={() => moveAsChild(target)}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50"
            >
              As child
            </button>
          </>
        )}
      />
    </div>
  );
}
