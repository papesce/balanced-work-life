"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, CornerDownRight } from "lucide-react";
import { Idea, IdeaType, Tag } from "@/lib/types";
import { IdeaSearchPicker } from "./IdeaSearchPicker";
import { getDefaultParentType } from "@/lib/ideaParentType";
import { FloatingPanel, type FloatingAnchor } from "@/components/shared/FloatingPanel";

interface MoveIdeaPanelProps {
  idea: Idea;
  ideas: Idea[];
  getTagsForIdea?: (ideaId: string) => Tag[];
  onMove: (newParentId: string | null, newSortOrder: number) => Promise<void>;
  onMoved: (parentIdToExpand: string | null) => void;
  onClose: () => void;
  variant?: "move" | "attach";
  className?: string;
  onAttach?: (parentId: string) => Promise<void>;
  /**
   * When set, renders in a FloatingPanel portal (FLOATING layer) so the
   * picker paints above glass-card stacking contexts instead of being
   * clipped behind sibling cards. Always prefer this over inline tails.
   */
  position?: FloatingAnchor;
  /**
   * When provided, the picker shows a "Create "<query>" as <type>" row
   * that creates a new root parent and moves this idea under it.
   * Should resolve to the new parent id.
   */
  onCreateParent?: (text: string, type: IdeaType) => Promise<string | null>;
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
  getTagsForIdea,
  onMove,
  onMoved,
  onClose,
  variant = "move",
  className,
  onAttach,
  onCreateParent,
  position,
}: MoveIdeaPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const excludedIds = getDescendantIds(idea.id, ideas);
  excludedIds.add(idea.id);

  useEffect(() => {
    // FloatingPanel owns outside-click/Escape/scroll handling when portaled.
    if (position) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, position]);

  const moveBelow = async (target: Idea) => {
    await onMove(target.parent_id, target.sort_order + 1);
    onMoved(null);
    onClose();
  };

  const moveAsChild = async (target: Idea) => {
    if (onAttach) {
      await onAttach(target.id);
    } else {
      await onMove(target.id, 0);
    }
    onMoved(target.id);
    onClose();
  };

  const verb = variant === "attach" ? "Attach" : "Move";
  const typeLabel = idea.type ?? "idea";

  const handleCreateParent = async (text: string, type: IdeaType) => {
    if (!onCreateParent) return;
    const newParentId = await onCreateParent(text, type);
    if (newParentId) {
      onMoved(newParentId);
      onClose();
    }
  };

  const content = (
    <>
      <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {verb} this {typeLabel}
      </div>
      <IdeaSearchPicker
        ideas={ideas}
        excludeIds={excludedIds}
        getTagsForIdea={getTagsForIdea}
        emptyLabel="No valid ideas"
        showCreateOption={!!onCreateParent}
        defaultCreateType={getDefaultParentType(idea.type)}
        onCreateNew={onCreateParent ? handleCreateParent : undefined}
        renderActions={(target) => (
          <>
            <button
              onClick={() => moveBelow(target)}
              title="Insert below"
              aria-label="Insert below"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
            >
              <ArrowDown size={14} />
            </button>
            <button
              onClick={() => moveAsChild(target)}
              title="Attach as child"
              aria-label="Attach as child"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
            >
              <CornerDownRight size={14} />
            </button>
          </>
        )}
      />
    </>
  );

  return position ? (
    <FloatingPanel
      anchor={position}
      onClose={onClose}
      className={
        className ??
        "glass-card-strong mt-1 max-w-[min(560px,90vw)] min-w-[420px] rounded-xl p-3 sm:min-w-[480px]"
      }
    >
      {content}
    </FloatingPanel>
  ) : (
    <div
      ref={ref}
      className={
        className ??
        "glass-card-strong absolute top-full right-0 z-50 mt-1 max-w-[min(560px,90vw)] min-w-[420px] rounded-xl p-3 sm:min-w-[480px]"
      }
    >
      {content}
    </div>
  );
}
