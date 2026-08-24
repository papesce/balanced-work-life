"use client";

import { useMemo, useState } from "react";
import { FileText, Focus as FocusIcon } from "lucide-react";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, Tag, LifeArea, LinkType } from "@/lib/types";
import { filterIdeaTree } from "@/lib/ideaTreeFilters";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { pruneTreeToIds } from "@/components/tree/filterTree";
import { TreeView, type ComposingState, type CreateIdeaPosition } from "@/components/tree";
import { getToday } from "@/lib/dateUtils";
import type { IdeasScope } from "@/hooks/useIdeas";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import {
  LinkCountBadge,
  ScheduleChip,
  StatusIconSlot,
  StatusPillSlot,
  TagChipsSlot,
  TypePillSlot,
} from "./ideaNodeSlots";

interface IdeaTreeProps {
  tree: IdeaNodeType[];
  ideas: Idea[];
  links: IdeaLink[];
  scope: IdeasScope;
  createIdea: (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
  ) => Promise<string>;
  updateIdea: (id: string, updates: Partial<Idea>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  moveIdea: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  toggleCollapse: (id: string) => void;
  expandIdea: (id: string) => void;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onMarkDone: (id: string) => Promise<void>;
  onMarkUndone: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  search: string;
  showType: boolean;
  showArea: boolean;
  editMode: "view" | "edit" | "insert";
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  composing: ComposingState | null;
  setComposing: (v: ComposingState | null) => void;
  showToday: boolean;
  hideClosed: boolean;
  hideCompleted: boolean;
  hideDeferred: boolean;
  focusedId: string | null;
  onFocus: (id: string | null) => void;
}

function getAncestorIds(ideaId: string, ideas: Idea[]): Set<string> {
  const ancestors = new Set<string>();
  const ideaMap = new Map(ideas.map((i) => [i.id, i]));
  let current = ideaMap.get(ideaId);
  while (current?.parent_id) {
    ancestors.add(current.parent_id);
    current = ideaMap.get(current.parent_id);
  }
  return ancestors;
}

function hasActiveDescendant(ideaId: string, ideas: Idea[]): boolean {
  const children = ideas.filter((i) => i.parent_id === ideaId);
  for (const child of children) {
    if (
      child.status !== "completed" &&
      child.status !== "cancelled" &&
      child.status !== "archived"
    ) {
      return true;
    }
    if (hasActiveDescendant(child.id, ideas)) return true;
  }
  return false;
}

function collectTreeIds(nodes: IdeaNodeType[], acc: Set<string> = new Set<string>()): Set<string> {
  for (const node of nodes) {
    acc.add(node.id);
    collectTreeIds(node.children, acc);
  }
  return acc;
}

export function IdeaTree({
  tree,
  ideas,
  links,
  scope,
  createIdea,
  updateIdea,
  deleteIdea,
  moveIdea,
  toggleCollapse,
  expandIdea,
  onCreateLink,
  onDeleteLink,
  onMarkDone,
  onMarkUndone,
  onSchedule,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  search,
  showType,
  showArea,
  editMode,
  editingId,
  setEditingId,
  selectedId,
  setSelectedId,
  composing,
  setComposing,
  showToday,
  hideClosed,
  hideCompleted,
  hideDeferred,
  focusedId,
  onFocus,
}: IdeaTreeProps) {
  const todayString = getToday();
  const [revealTarget, setRevealTarget] = useState<Idea | null>(null);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);

  const filteredTree = useMemo(() => {
    let filtered = filterIdeaTree(tree, ideas, { search, hideClosed, hideCompleted, hideDeferred });

    if (showToday) {
      const passingIds = new Set<string>();
      for (const idea of ideas) {
        let passes = true;
        if (idea.scheduled_date !== todayString) passes = false;
        if (idea.status === "completed" && !hasActiveDescendant(idea.id, ideas)) passes = false;
        if (passes) passingIds.add(idea.id);
      }
      const visibleIds = new Set(passingIds);
      for (const id of passingIds) {
        for (const aid of getAncestorIds(id, ideas)) visibleIds.add(aid);
      }
      filtered = pruneTreeToIds(filtered, visibleIds);
    }

    if (focusedId) {
      const focusIds = getFocusedSubtreeIds(focusedId, ideas);
      const treeIds = collectTreeIds(filtered);
      const visibleFocusIds = new Set<string>();
      for (const id of focusIds) {
        if (treeIds.has(id)) visibleFocusIds.add(id);
      }
      filtered = pruneTreeToIds(filtered, visibleFocusIds);
    }

    return filtered;
  }, [
    tree,
    ideas,
    search,
    hideClosed,
    hideCompleted,
    hideDeferred,
    showToday,
    focusedId,
    todayString,
  ]);

  const labelClassName = (node: IdeaNodeType): string => {
    switch (node.status) {
      case "completed":
        return "text-violet-600/70 dark:text-violet-400/60";
      case "cancelled":
        return "text-red-400/60 dark:text-red-400/50";
      case "paused":
        return "text-orange-600/70 dark:text-orange-400/60";
      case "in_progress":
        return "text-amber-700 dark:text-amber-300";
      default:
        return "text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-3">
      <TreeView
        nodes={filteredTree}
        items={ideas}
        className="space-y-0.5"
        onMove={moveIdea}
        onCreate={createIdea}
        onRename={(id, text) => updateIdea(id, { text })}
        onDelete={deleteIdea}
        onToggleCollapse={toggleCollapse}
        onExpand={expandIdea}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        editingId={editingId}
        setEditingId={setEditingId}
        composing={composing}
        setComposing={setComposing}
        getLabel={(idea) => idea.text}
        emptyLabel="empty"
        editPlaceholder="Type an idea..."
        onContextMenu={(node, e) => {
          e.preventDefault();
          setRevealTarget(node as Idea);
          setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        }}
        editBehavior={{
          deleteEmptyOnConfirm: true,
          deleteEmptyOnCancel: true,
          createChildOnTab: true,
        }}
        disableInsert={Boolean(search.trim()) || editMode === "view"}
        labelClassName={labelClassName}
        renderLeading={(node) => (
          <StatusIconSlot node={node} onMarkDone={onMarkDone} onMarkUndone={onMarkUndone} />
        )}
        renderTrailing={(node) => (
          <>
            {node.notes?.trim() && (
              <button
                type="button"
                title="Has notes"
                aria-label="Show notes"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(node.id);
                }}
                className={`flex flex-shrink-0 items-center ${
                  selectedId === node.id
                    ? "text-indigo-400 dark:text-indigo-400"
                    : "text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                }`}
              >
                <FileText size={11} strokeWidth={2} />
              </button>
            )}
            {showType && <TypePillSlot node={node} onUpdate={updateIdea} />}
            {showArea && (
              <TagChipsSlot
                node={node}
                allTags={allTags}
                getTagsForIdea={getTagsForIdea}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onCreateTag={onCreateTag}
              />
            )}
            <StatusPillSlot node={node} onUpdate={updateIdea} />
            <LinkCountBadge nodeId={node.id} links={links} />
            <ScheduleChip node={node} todayString={todayString} />
            {focusedId !== node.id && (
              <button
                type="button"
                title="Focus on this idea and its subtree"
                aria-label="Focus on this idea and its subtree"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(node.id);
                }}
                className="flex flex-shrink-0 items-center text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
              >
                <FocusIcon size={12} strokeWidth={2} />
              </button>
            )}
            <IdeaActionMenu
              idea={node}
              allIdeas={ideas}
              links={links}
              hasChildren={node.children.length > 0}
              getTagsForIdea={getTagsForIdea}
              hiddenActions={editMode === "edit" ? [] : ["edit"]}
              onEdit={() => {
                setSelectedId(node.id);
                setEditingId(node.id);
              }}
              onUpdate={updateIdea}
              onDelete={deleteIdea}
              onSchedule={onSchedule}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              onMove={moveIdea}
              onMoved={(id) => {
                if (id) expandIdea(id);
              }}
              currentView="brainstorm"
            />
          </>
        )}
        inlineEditEnabled={editMode === "edit"}
        clickToInsert={editMode === "insert"}
        emptyMessage={
          <p className="py-4 text-sm text-gray-400 italic">
            {search
              ? "No matching ideas"
              : scope === "this_month"
                ? 'No ideas this month. Click "+ New idea" to add one, or switch to All to see everything.'
                : 'No ideas yet. Click "+ New idea" to start.'}
          </p>
        }
      />
      {revealTarget && revealPos && (
        <RevealInMenu
          idea={revealTarget}
          currentView="brainstorm"
          position={revealPos}
          onClose={() => setRevealTarget(null)}
        />
      )}
    </div>
  );
}
