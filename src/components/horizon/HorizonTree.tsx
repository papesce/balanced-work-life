"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import {
  Idea,
  IdeaLink,
  IdeaNode as IdeaNodeType,
  IdeaStatus,
  IdeaType,
  LifeArea,
  LinkType,
  Tag,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import {
  TreeView,
  type ComposingState,
  type CreateIdeaPosition,
  type TreeNode,
} from "@/components/tree";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TagPicker } from "@/components/shared/TagPicker";

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  idea: {
    label: "Idea",
    className: "bg-orange-100/80 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  },
  objective: {
    label: "Objective",
    className: "bg-purple-100/80 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  },
  project: {
    label: "Project",
    className: "bg-blue-100/80 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  initiative: {
    label: "Initiative",
    className: "bg-violet-100/80 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  },
  task: {
    label: "Task",
    className: "bg-gray-100/80 text-gray-500 dark:bg-gray-800/40 dark:text-gray-400",
  },
};

function PriorityStarSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void onUpdate(node.id, { is_priority: !node.is_priority });
      }}
      className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
      title={node.is_priority ? "Remove priority" : "Set priority"}
    >
      <Star
        size={13}
        className={
          node.is_priority
            ? "fill-amber-400 text-amber-400"
            : "text-gray-300 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500"
        }
      />
    </button>
  );
}

function TypeBadgeSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const badge = node.type ? TYPE_BADGE[node.type] : null;
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={
          badge
            ? `rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`
            : "rounded-full px-1.5 py-0 text-[10px] font-semibold text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
        }
      >
        {badge?.label ?? "Type"}
      </button>
      {showPicker && (
        <TypePicker
          current={node.type}
          onSelect={(type) => {
            void onUpdate(node.id, { type });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

function HorizonTagsSlot({
  node,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: {
  node: IdeaNodeType;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => void;
  onRemoveTag: (ideaId: string, tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const nodeTags = getTagsForIdea(node.id);
  return (
    <>
      {nodeTags.length > 0 && (
        <div className="flex flex-shrink-0 gap-0.5">
          {nodeTags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-black/[0.04] px-1.5 py-0 text-[10px] text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
            >
              {tag.name}
            </span>
          ))}
          {nodeTags.length > 2 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              +{nodeTags.length - 2}
            </span>
          )}
        </div>
      )}
      <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
          title="Tags"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </button>
        {showPicker && (
          <TagPicker
            allTags={allTags}
            selectedTags={nodeTags}
            onAdd={(tag) => onAddTag(node.id, tag)}
            onRemove={(tagId) => onRemoveTag(node.id, tagId)}
            onCreateTag={onCreateTag}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </>
  );
}

function StatusChipSlot({
  node,
  onUpdate,
}: {
  node: IdeaNodeType;
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleStatusSelect = (status: IdeaStatus) => {
    const updates: Partial<Idea> = { status };
    if (status === "completed") updates.completed_at = new Date().toISOString();
    if (status === "paused") updates.paused_at = new Date().toISOString();
    if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
    void onUpdate(node.id, updates);
    setShowPicker(false);
  };

  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[node.status]}`}
      >
        {STATUS_LABELS[node.status]}
      </button>
      {showPicker && (
        <div className="absolute top-full right-0 z-50 mt-1">
          <StatusPicker
            current={node.status}
            onSelect={handleStatusSelect}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}

function ComposingTypePill({
  initialType,
  onSelect,
}: {
  initialType: IdeaType;
  onSelect: (type: IdeaType) => void;
}) {
  const [type, setType] = useState<IdeaType>(initialType);
  const [showPicker, setShowPicker] = useState(false);
  const badge = TYPE_BADGE[type];
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge?.className ?? ""} cursor-pointer transition-opacity hover:opacity-80`}
      >
        {badge?.label ?? "Task"}
      </button>
      {showPicker && (
        <TypePicker
          current={type}
          onSelect={(next) => {
            const chosen = next ?? "task";
            setType(chosen);
            onSelect(chosen);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export interface HorizonTreeProps {
  nodes: TreeNode<Idea>[];
  ideas: Idea[];
  allTags: Tag[];
  links: IdeaLink[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onUpdate: (id: string, updates: Partial<Idea>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  onMove: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onAddTag: (ideaId: string, tag: Tag) => void;
  onRemoveTag: (ideaId: string, tagId: string) => void;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  createIdea: (
    text: string,
    parentId: string | null,
    position: CreateIdeaPosition,
    initialUpdates?: Partial<Idea>,
  ) => Promise<string>;
  onToggleCollapse: (id: string) => void;
  onExpand: (id: string) => void;
  emptyMessage?: React.ReactNode;
}

export function HorizonTree({
  nodes,
  ideas,
  allTags,
  links,
  getTagsForIdea,
  onUpdate,
  onDelete,
  onSchedule,
  onMove,
  onCreateLink,
  onDeleteLink,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  createIdea,
  onToggleCollapse,
  onExpand,
  emptyMessage,
}: HorizonTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composing, setComposing] = useState<ComposingState | null>(null);

  return (
    <TreeView
      nodes={nodes}
      items={ideas}
      className="divide-y divide-black/[0.03] dark:divide-white/[0.03]"
      rowsClassName=""
      onMove={onMove}
      onCreate={(text, parentId, position, meta) =>
        createIdea(text, parentId, position, {
          type: (meta as IdeaType) ?? "task",
          status: "draft",
        })
      }
      onRename={(id, text) => onUpdate(id, { text })}
      onDelete={onDelete}
      onToggleCollapse={onToggleCollapse}
      onExpand={onExpand}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      editingId={editingId}
      setEditingId={setEditingId}
      composing={composing}
      setComposing={setComposing}
      getLabel={(idea) => idea.text}
      emptyLabel="Untitled"
      rowClassName="px-3 py-2 gap-1.5"
      renderLeading={(node) => <PriorityStarSlot node={node} onUpdate={onUpdate} />}
      renderTrailing={(node) => (
        <>
          <TypeBadgeSlot node={node} onUpdate={onUpdate} />
          <HorizonTagsSlot
            node={node}
            allTags={allTags}
            getTagsForIdea={getTagsForIdea}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateTag={onCreateTag}
          />
          <StatusChipSlot node={node} onUpdate={onUpdate} />
          {links.filter((l) => l.source_id === node.id || l.target_id === node.id).length > 0 && (
            <span className="flex-shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
              {links.filter((l) => l.source_id === node.id || l.target_id === node.id).length}
            </span>
          )}
          <IdeaActionMenu
            idea={node}
            allIdeas={ideas}
            links={links}
            hasChildren={node.children.length > 0}
            onEdit={() => setEditingId(node.id)}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onSchedule={onSchedule}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onMove={onMove}
            hiddenActions={["move"]}
          />
        </>
      )}
      composerLeading={(node, composingState, setMeta) => (
        <ComposingTypePill
          initialType={(composingState.meta as IdeaType) ?? "task"}
          onSelect={setMeta}
        />
      )}
      composerPlaceholder={() => "Add child..."}
      emptyMessage={emptyMessage}
    />
  );
}
