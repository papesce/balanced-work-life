"use client";

import { IdeaNode as IdeaNodeType, Idea, IdeaLink, Tag, LifeArea, LinkType } from "@/lib/types";
import { filterIdeaTree } from "@/lib/ideaTreeFilters";
import { IdeaNode } from "./IdeaNode";
import { getToday } from "@/lib/dateUtils";
import type { IdeasScope } from "@/hooks/useIdeas";

interface IdeaTreeProps {
  tree: IdeaNodeType[];
  ideas: Idea[];
  links: IdeaLink[];
  scope: IdeasScope;
  createIdea: (
    text: string,
    parentId?: string | null,
    position?: "top" | "bottom",
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
  composing: {
    nodeId: string;
    parentId: string | null;
    position: "child" | "top" | "bottom";
    depth: number;
  } | null;
  setComposing: (
    v: {
      nodeId: string;
      parentId: string | null;
      position: "child" | "top" | "bottom";
      depth: number;
    } | null,
  ) => void;
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

  let filteredTree = filterIdeaTree(tree, ideas, { search, hideClosed });

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
    const pruneNode = (node: IdeaNodeType): IdeaNodeType | null => {
      if (!visibleIds.has(node.id)) return null;
      const children = node.children.map(pruneNode).filter(Boolean) as IdeaNodeType[];
      return { ...node, children };
    };
    filteredTree = filteredTree.map(pruneNode).filter(Boolean) as IdeaNodeType[];
  }

  return (
    <div
      className="space-y-3"
      onClick={() => {
        setSelectedId(null);
        setComposing(null);
      }}
    >
      {filteredTree.length === 0 ? (
        <p className="py-4 text-sm text-gray-400 italic">
          {search
            ? "No matching ideas"
            : scope === "this_month"
              ? 'No ideas this month. Click "+ New idea" to add one, or switch to All to see everything.'
              : 'No ideas yet. Click "+ New idea" to start.'}
        </p>
      ) : (
        <div className="space-y-0.5">
          {filteredTree.map((node) => (
            <IdeaNode
              key={node.id}
              node={node}
              depth={0}
              showType={showType}
              showArea={showArea}
              search={search}
              editingId={editingId}
              setEditingId={setEditingId}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              composing={composing}
              setComposing={setComposing}
              createIdea={createIdea}
              updateIdea={updateIdea}
              deleteIdea={deleteIdea}
              moveIdea={moveIdea}
              toggleCollapse={toggleCollapse}
              expandIdea={expandIdea}
              allIdeas={ideas}
              links={links}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              onMarkDone={onMarkDone}
              onMarkUndone={onMarkUndone}
              onSchedule={onSchedule}
              todayString={todayString}
              isAncestorOnly={false}
              allTags={allTags}
              getTagsForIdea={getTagsForIdea}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onCreateTag={onCreateTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
