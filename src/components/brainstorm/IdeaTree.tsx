"use client";

import { useState } from "react";
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
  expandAll: () => void;
  collapseAll: () => void;
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
  expandAll,
  collapseAll,
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
}: IdeaTreeProps) {
  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showToday, setShowToday] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const todayString = getToday();

  const handleAddRoot = async () => {
    const id = await createIdea("", null, "top");
    if (id) {
      setSelectedId(id);
      setEditingId(id);
    }
  };

  const matchesSearch = (node: IdeaNodeType): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (node.text.toLowerCase().includes(q)) return true;
    return node.children.some(matchesSearch);
  };

  const searchFiltered = search ? tree.filter(matchesSearch) : tree;

  let filteredTree = searchFiltered;

  if (showToday || hideDone) {
    const passingIds = new Set<string>();
    for (const idea of ideas) {
      let passes = true;
      if (showToday && idea.scheduled_date !== todayString) passes = false;
      if (hideDone && (idea.status === "completed" || idea.status === "cancelled")) passes = false;
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
    <div className="space-y-3" onClick={() => setSelectedId(null)}>
      {/* Row 1: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddRoot}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          + New idea
        </button>
        <button
          onClick={expandAll}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Expand
        </button>
        <button
          onClick={collapseAll}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Collapse
        </button>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[120px] flex-1 rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-500 dark:border-white/10 dark:bg-gray-800/60 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-indigo-400"
        />
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <button
            onClick={() => setShowType(!showType)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              showType
                ? "border-indigo-300 bg-white font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
                : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            }`}
          >
            Type
          </button>
          <button
            onClick={() => setShowArea(!showArea)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              showArea
                ? "border-indigo-300 bg-white font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
                : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            }`}
          >
            Area
          </button>
        </div>

        <span className="text-gray-200">|</span>

        <div className="flex gap-1">
          <button
            onClick={() => setShowToday(!showToday)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              showToday
                ? "border-indigo-300 bg-white font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
                : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setHideDone(!hideDone)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              hideDone
                ? "border-indigo-300 bg-white font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-gray-700 dark:text-indigo-300"
                : "border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
            }`}
          >
            Hide done
          </button>
        </div>
      </div>

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
