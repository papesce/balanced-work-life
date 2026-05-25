"use client";

import { useState } from "react";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, IdeaType, LifeArea, LinkType, Task, TimeBucket } from "@/lib/types";
import { IdeaNode } from "./IdeaNode";

interface IdeaTreeProps {
  tree: IdeaNodeType[];
  ideas: Idea[];
  links: IdeaLink[];
  activeTasksByIdeaId: Map<string, Task>;
  createIdea: (text: string, parentId?: string | null) => Promise<string>;
  updateIdea: (id: string, updates: Partial<Idea>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  moveIdea: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  toggleCollapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onPromote: (ideaId: string, bucket: TimeBucket) => void;
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
  expandAll,
  collapseAll,
  onCreateLink,
  onDeleteLink,
  onPromote,
}: IdeaTreeProps) {
  const [search, setSearch] = useState("");
  const [showType, setShowType] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddRoot = async () => {
    const id = await createIdea("");
    if (id) setEditingId(id);
  };

  const matchesSearch = (node: IdeaNodeType): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (node.text.toLowerCase().includes(q)) return true;
    return node.children.some(matchesSearch);
  };

  const filteredTree = search ? tree.filter(matchesSearch) : tree;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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
              createIdea={createIdea}
              updateIdea={updateIdea}
              deleteIdea={deleteIdea}
              moveIdea={moveIdea}
              toggleCollapse={toggleCollapse}
              allIdeas={ideas}
              links={links}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              activeTasksByIdeaId={activeTasksByIdeaId}
              onPromote={onPromote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
