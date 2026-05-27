"use client";

import { useState } from "react";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, LinkType, Task, TimeBucket } from "@/lib/types";
import { IdeaNode } from "./IdeaNode";

interface IdeaTreeProps {
  tree: IdeaNodeType[];
  ideas: Idea[];
  links: IdeaLink[];
  activeTasksByIdeaId: Map<string, Task>;
  createIdea: (text: string, parentId?: string | null, position?: "top" | "bottom") => Promise<string>;
  updateIdea: (id: string, updates: Partial<Idea>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  moveIdea: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  toggleCollapse: (id: string) => void;
  expandIdea: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onPromote: (ideaId: string, bucket: TimeBucket) => void;
  onMarkDone: (id: string) => Promise<void>;
  onMarkUndone: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
}

function getAncestorIds(ideaId: string, ideas: Idea[]): Set<string> {
  const ancestors = new Set<string>();
  const ideaMap = new Map(ideas.map(i => [i.id, i]));
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
  activeTasksByIdeaId,
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
  onPromote,
  onMarkDone,
  onMarkUndone,
  onSchedule,
}: IdeaTreeProps) {
  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<"all" | "today">("all");
  const [hideDone, setHideDone] = useState(false);
  const todayString = new Date().toISOString().split("T")[0];

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

  if (timeFilter === "today" || hideDone) {
    const passingIds = new Set<string>();
    for (const idea of ideas) {
      let passes = true;
      if (timeFilter === "today" && idea.scheduled_date !== todayString) passes = false;
      if (hideDone && idea.done_at) passes = false;
      if (passes) passingIds.add(idea.id);
    }
    const visibleIds = new Set(passingIds);
    if (timeFilter === "today") {
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
          className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + New idea
        </button>
        <button
          onClick={expandAll}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
        >
          Expand
        </button>
        <button
          onClick={collapseAll}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
        >
          Collapse
        </button>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[120px] text-sm px-3 py-1.5 border border-gray-300 rounded-md outline-none focus:border-indigo-500 bg-white"
        />
      </div>

      {/* Row 2: Filters */}
      <div className="flex items-center gap-3">
        {/* Display toggles */}
        <div className="flex gap-1">
          <button
            onClick={() => setShowType(!showType)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              showType
                ? "bg-white border-indigo-300 text-indigo-700 font-medium"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            Type
          </button>
          <button
            onClick={() => setShowArea(!showArea)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              showArea
                ? "bg-white border-indigo-300 text-indigo-700 font-medium"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            Area
          </button>
        </div>

        <span className="text-gray-200">|</span>

        {/* Time filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setTimeFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              timeFilter === "all"
                ? "bg-white border-indigo-300 text-indigo-700 font-medium"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTimeFilter("today")}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              timeFilter === "today"
                ? "bg-white border-indigo-300 text-indigo-700 font-medium"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            Today
          </button>
        </div>

        <span className="text-gray-200">|</span>

        {/* Done filter */}
        <button
          onClick={() => setHideDone(!hideDone)}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            hideDone
              ? "bg-white border-indigo-300 text-indigo-700 font-medium"
              : "bg-gray-100 border-gray-200 text-gray-500"
          }`}
        >
          Hide done
        </button>
      </div>


      {filteredTree.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-4">
          {search ? "No matching ideas" : "No ideas yet. Click \"+ New idea\" to start."}
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
              activeTasksByIdeaId={activeTasksByIdeaId}
              onPromote={onPromote}
              onMarkDone={onMarkDone}
              onMarkUndone={onMarkUndone}
              onSchedule={onSchedule}
              todayString={todayString}
              isAncestorOnly={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
