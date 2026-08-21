"use client";

import { useMemo } from "react";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, Tag, LifeArea, LinkType } from "@/lib/types";
import { filterIdeaTree } from "@/lib/ideaTreeFilters";
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
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  composing: ComposingState | null;
  setComposing: (v: ComposingState | null) => void;
  showToday: boolean;
  hideClosed: boolean;
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
  editingId,
  setEditingId,
  selectedId,
  setSelectedId,
  composing,
  setComposing,
  showToday,
  hideClosed,
}: IdeaTreeProps) {
  const todayString = getToday();

  const filteredTree = useMemo(() => {
    let filtered = filterIdeaTree(tree, ideas, { search, hideClosed });

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

    return filtered;
  }, [tree, ideas, search, hideClosed, showToday, todayString]);

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
        editBehavior={{
          deleteEmptyOnConfirm: true,
          deleteEmptyOnCancel: true,
          createChildOnTab: true,
        }}
        disableInsert={Boolean(search.trim())}
        labelClassName={labelClassName}
        renderLeading={(node) => (
          <StatusIconSlot node={node} onMarkDone={onMarkDone} onMarkUndone={onMarkUndone} />
        )}
        renderTrailing={(node) => (
          <>
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
            <IdeaActionMenu
              idea={node}
              allIdeas={ideas}
              links={links}
              hasChildren={node.children.length > 0}
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
            />
          </>
        )}
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
    </div>
  );
}
