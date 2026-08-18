"use client";

import { IdeaNode as IdeaNodeType, Idea, IdeaLink, Tag, LifeArea, LinkType } from "@/lib/types";
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
    position: "top" | "bottom";
    composerDepth: number;
  } | null;
  setComposing: (
    v: {
      nodeId: string;
      parentId: string | null;
      position: "top" | "bottom";
      composerDepth: number;
    } | null,
  ) => void;
  insertion: {
    nodeId: string;
    position: "top" | "bottom";
    targetDepth: number;
  } | null;
  setInsertion: (
    v: {
      nodeId: string;
      position: "top" | "bottom";
      targetDepth: number;
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
  insertion,
  setInsertion,
  showToday,
  hideClosed,
}: IdeaTreeProps) {
  const todayString = getToday();

  const matchesSearch = (node: IdeaNodeType): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (node.text.toLowerCase().includes(q)) return true;
    return node.children.some(matchesSearch);
  };

  const searchFiltered = search ? tree.filter(matchesSearch) : tree;

  let filteredTree = searchFiltered;

  {
    const passingIds = new Set<string>();
    for (const idea of ideas) {
      let passes = true;
      if (showToday && idea.scheduled_date !== todayString) passes = false;
      if (idea.status === "completed" && !hasActiveDescendant(idea.id, ideas)) passes = false;
      if (hideClosed && (idea.status === "cancelled" || idea.status === "archived")) passes = false;
      if (passes) passingIds.add(idea.id);
    }
    const visibleIds = new Set(passingIds);
    if (showToday) {
      for (const id of passingIds) {
        for (const aid of getAncestorIds(id, ideas)) visibleIds.add(aid);
      }
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
        setInsertion(null);
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
            <div key={node.id}>
              {insertion?.nodeId === node.id && insertion.position === "top" && (
                <div className="relative h-0">
                  <div
                    className="absolute top-0 h-[2px] rounded-full bg-indigo-400 dark:bg-indigo-500"
                    style={{ left: insertion.targetDepth * 20, right: 0 }}
                  />
                </div>
              )}
              <IdeaNode
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
                insertion={insertion}
                setInsertion={setInsertion}
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
              {insertion?.nodeId === node.id && insertion.position === "bottom" && (
                <div className="relative h-0">
                  <div
                    className="absolute top-0 h-[2px] rounded-full bg-indigo-400 dark:bg-indigo-500"
                    style={{ left: insertion.targetDepth * 20, right: 0 }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
