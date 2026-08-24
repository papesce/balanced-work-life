"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Star, Target } from "lucide-react";
import {
  Idea,
  IdeaLink,
  IdeaNode as IdeaNodeType,
  IdeaStatus,
  IdeaType,
  IdeaHorizon,
  LifeArea,
  LinkType,
  Tag,
  LaneConfig,
} from "@/lib/types";
import { STATUS_LABELS, STATUS_STYLES, TYPE_BADGE } from "@/lib/constants";
import { type ComposingState, type CreateIdeaPosition, type TreeNode } from "@/components/tree";
import { TreeDnd } from "@/components/tree/useTreeDnd";
import { TreeProvider } from "@/components/tree/context";
import { TreeNodeRow } from "@/components/tree/TreeNodeRow";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TagPicker } from "@/components/shared/TagPicker";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";

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

function LaneSection({
  laneId,
  label,
  children,
  count,
}: {
  laneId: string;
  label: string;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId });
  return (
    <div
      ref={setNodeRef}
      className={`border-b border-black/[0.03] last:border-b-0 dark:border-white/[0.03] ${isOver ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""}`}
    >
      <div className="flex items-center justify-between bg-black/[0.02] px-3 py-1.5 dark:bg-white/[0.02]">
        <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {label}
        </span>
        <span className="rounded-full bg-white px-1.5 py-0 text-[10px] text-gray-400 dark:bg-gray-800 dark:text-gray-500">
          {count}
        </span>
      </div>
      <div className="min-h-[32px]">{children}</div>
    </div>
  );
}

export interface HorizonTreeProps {
  nodes: TreeNode<Idea>[];
  ideas: Idea[];
  horizon: IdeaHorizon;
  laneConfigs: LaneConfig[];
  unassignedLabel: string;
  isLoading?: boolean;
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
  onToggleInFocus?: (id: string, until?: string | null) => Promise<void>;
  cardMode?: boolean;
}

export function HorizonTree({
  nodes,
  ideas,
  horizon,
  laneConfigs,
  unassignedLabel,
  isLoading,
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
  onToggleInFocus,
  cardMode,
}: HorizonTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composing, setComposing] = useState<ComposingState | null>(null);
  const [revealTarget, setRevealTarget] = useState<Idea | null>(null);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const { openNotes } = useNotes();

  const laneIds = new Set(laneConfigs.map((l) => l.id));

  const unassignedNodes = nodes.filter((n) => n.focus_lane == null || !laneIds.has(n.focus_lane));
  const laneGroups = new Map<string, TreeNode<Idea>[]>();
  for (const lc of laneConfigs) laneGroups.set(lc.id, []);
  for (const node of nodes) {
    if (node.focus_lane && laneGroups.has(node.focus_lane)) {
      laneGroups.get(node.focus_lane)!.push(node);
    }
  }

  const handleLaneDrop = (draggedId: string, lane: string | null) => {
    void onUpdate(draggedId, { focus_lane: lane });
  };

  const treeOptions: import("@/components/tree").TreeOptions<Idea> = {
    getLabel: (idea: Idea) => idea.text,
    emptyLabel: "Untitled",
    rowClassName: "px-3 py-2 gap-1.5",
    cardMode,
    onContextMenu: (node, e) => {
      e.preventDefault();
      setRevealTarget(node as Idea);
      setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
    },
    renderLeading: (node: IdeaNodeType) => <PriorityStarSlot node={node} onUpdate={onUpdate} />,
    renderTrailing: (node: IdeaNodeType) => (
      <>
        <NotesIndicator hasNotes={!!node.notes?.trim()} onClick={() => openNotes(node.id)} />
        {node.in_focus && (
          <span
            title="In Focus"
            className="flex flex-shrink-0 items-center text-amber-500 dark:text-amber-400"
          >
            <Target size={13} strokeWidth={1.75} />
          </span>
        )}
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
          laneConfigs={laneConfigs}
          unassignedLabel={unassignedLabel}
          hasChildren={node.children.length > 0}
          getTagsForIdea={getTagsForIdea}
          onEdit={() => setEditingId(node.id)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onSchedule={onSchedule}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onMove={onMove}
          hiddenActions={["move"]}
          onToggleInFocus={onToggleInFocus}
          currentView="horizon"
        />
      </>
    ),
    composerLeading: (
      node: IdeaNodeType,
      composingState: ComposingState,
      setMeta: (meta: unknown) => void,
    ) => (
      <ComposingTypePill
        initialType={(composingState.meta as IdeaType) ?? "task"}
        onSelect={setMeta}
      />
    ),
    composerPlaceholder: () => "Add child...",
  };

  const controller = {
    items: ideas,
    onMove,
    onCreate: (
      text: string,
      parentId: string | null,
      position: CreateIdeaPosition,
      meta?: unknown,
    ) =>
      createIdea(text, parentId, position, {
        type: (meta as IdeaType) ?? "task",
        status: "draft",
        horizon,
      }),
    onRename: (id: string, text: string) => onUpdate(id, { text }),
    onDelete,
    onToggleCollapse,
    onExpand,
  };

  const ui = {
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    composing,
    setComposing,
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <div className="h-6 animate-pulse rounded bg-black/5 dark:bg-white/5" />
        <div className="h-10 animate-pulse rounded bg-black/[0.03] dark:bg-white/[0.03]" />
        <div className="h-10 animate-pulse rounded bg-black/[0.03] dark:bg-white/[0.03]" />
      </div>
    );
  }

  if (nodes.length === 0 && emptyMessage) {
    return <div>{emptyMessage}</div>;
  }

  const renderLaneContent = (laneNodes: TreeNode<Idea>[]) => {
    if (laneNodes.length === 0) {
      return (
        <p className="px-4 py-2 text-center text-xs text-gray-400 italic dark:text-gray-500">
          Empty
        </p>
      );
    }
    return (
      <div>
        {laneNodes.map((node, index) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={0}
            isLastSibling={index === laneNodes.length - 1}
          />
        ))}
      </div>
    );
  };

  // 0 lanes => render flat list without lane chrome (unassigned hidden)
  // When loading, skeleton already returned above, so this is genuine empty.
  if (laneConfigs.length === 0) {
    return (
      <>
        <TreeDnd
          items={ideas}
          onMove={onMove}
          getLabel={(idea) => idea.text}
          onLaneDrop={handleLaneDrop}
        >
          <TreeProvider value={{ controller, ui, options: treeOptions }}>
            <div>{renderLaneContent(nodes)}</div>
          </TreeProvider>
        </TreeDnd>
        {revealTarget && revealPos && (
          <RevealInMenu
            idea={revealTarget}
            currentView="horizon"
            position={revealPos}
            onClose={() => setRevealTarget(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <TreeDnd
        items={ideas}
        onMove={onMove}
        getLabel={(idea) => idea.text}
        onLaneDrop={handleLaneDrop}
      >
        <TreeProvider value={{ controller, ui, options: treeOptions }}>
          <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
            <LaneSection
              laneId={`lane:${horizon}:null`}
              label={unassignedLabel}
              count={unassignedNodes.length}
            >
              {renderLaneContent(unassignedNodes)}
            </LaneSection>
            {laneConfigs.map((lc) => (
              <LaneSection
                key={lc.id}
                laneId={`lane:${horizon}:${lc.id}`}
                label={lc.label}
                count={laneGroups.get(lc.id)?.length ?? 0}
              >
                {renderLaneContent(laneGroups.get(lc.id) ?? [])}
              </LaneSection>
            ))}
          </div>
        </TreeProvider>
      </TreeDnd>
      {revealTarget && revealPos && (
        <RevealInMenu
          idea={revealTarget}
          currentView="horizon"
          position={revealPos}
          onClose={() => setRevealTarget(null)}
        />
      )}
    </>
  );
}
