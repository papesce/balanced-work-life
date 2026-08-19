"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Star } from "lucide-react";
import { Idea, IdeaNode, IdeaStatus, Tag, IdeaLink, LinkType, LifeArea } from "@/lib/types";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TagPicker } from "@/components/shared/TagPicker";

const STATUS_STYLES: Record<IdeaStatus, string> = {
  draft: "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent",
  planned:
    "border-sky-200 dark:border-sky-700/30 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
  scheduled:
    "border-blue-200 dark:border-blue-700/30 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  in_progress:
    "border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  paused:
    "border-orange-200 dark:border-orange-700/30 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
  completed:
    "border-violet-200 dark:border-violet-700/30 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300",
  cancelled:
    "border-red-200 dark:border-red-700/30 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
  archived: "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent",
  deferred:
    "border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
};

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  scheduled: "Scheduled",
  in_progress: "Active",
  paused: "Paused",
  completed: "Done",
  cancelled: "Cancelled",
  archived: "Archived",
  deferred: "Deferred",
};

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

interface HorizonIdeaCardProps {
  node: IdeaNode;
  depth: number;
  allIdeas: Idea[];
  allTags: Tag[];
  links: IdeaLink[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  showTagPickerFor: string | null;
  setShowTagPickerFor: (id: string | null) => void;
  showStatusPickerFor: string | null;
  setShowStatusPickerFor: (id: string | null) => void;
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
  onToggleCollapse: (id: string) => void;
  onExpandIdea: (id: string) => void;
}

function InlineEditInput({
  idea,
  onConfirm,
  onCancel,
}: {
  idea: Idea;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      defaultValue={idea.text}
      className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none dark:text-gray-200"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onConfirm((e.target as HTMLInputElement).value);
        }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => onConfirm(e.target.value)}
    />
  );
}

export function HorizonIdeaCard({
  node,
  depth,
  allIdeas,
  allTags,
  links,
  editingId,
  setEditingId,
  showTagPickerFor,
  setShowTagPickerFor,
  showStatusPickerFor,
  setShowStatusPickerFor,
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
  onToggleCollapse,
  onExpandIdea,
}: HorizonIdeaCardProps) {
  const hasChildren = node.children.length > 0;
  const isEditing = editingId === node.id;
  const nodeTags = getTagsForIdea(node.id);
  const linkCount = links.filter((l) => l.source_id === node.id || l.target_id === node.id).length;
  const badge = node.type ? TYPE_BADGE[node.type] : null;
  const [showTypePicker, setShowTypePicker] = useState(false);

  const handleStatusSelect = (status: IdeaStatus) => {
    const updates: Partial<Idea> = { status };
    if (status === "completed") updates.completed_at = new Date().toISOString();
    if (status === "paused") updates.paused_at = new Date().toISOString();
    if (status === "cancelled") updates.cancelled_at = new Date().toISOString();
    onUpdate(node.id, updates);
    setShowStatusPickerFor(null);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 px-3 py-2 transition-colors hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
        style={{ paddingLeft: depth * 20 + 12 }}
      >
        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(node.id)}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:bg-black/[0.06] dark:text-gray-500 dark:hover:bg-white/[0.06]"
          >
            {node.collapsed ? (
              <ChevronRight size={12} strokeWidth={2} />
            ) : (
              <ChevronDown size={12} strokeWidth={2} />
            )}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Priority star */}
        <button
          onClick={() => onUpdate(node.id, { is_priority: !node.is_priority })}
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

        {/* Text */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <InlineEditInput
              idea={node}
              onConfirm={(text) => {
                if (text.trim()) onUpdate(node.id, { text: text.trim() });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <span
              onClick={() => setEditingId(node.id)}
              className="block cursor-text truncate text-sm text-gray-800 dark:text-gray-200"
            >
              {node.text || "Untitled"}
            </span>
          )}
        </div>

        {/* Type pill */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {badge ? (
            <button
              onClick={() => setShowTypePicker(!showTypePicker)}
              className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`}
            >
              {badge.label}
            </button>
          ) : (
            <button
              onClick={() => setShowTypePicker(!showTypePicker)}
              className="rounded-full px-1.5 py-0 text-[10px] font-semibold text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
            >
              Type
            </button>
          )}
          {showTypePicker && (
            <TypePicker
              current={node.type}
              onSelect={(type) => {
                onUpdate(node.id, { type });
                if (type) localStorage.setItem("horizon-last-type", type);
                setShowTypePicker(false);
              }}
              onClose={() => setShowTypePicker(false)}
            />
          )}
        </div>

        {/* Tag chips */}
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

        {/* Status chip */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowStatusPickerFor(showStatusPickerFor === node.id ? null : node.id)}
            className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[node.status]}`}
          >
            {STATUS_LABELS[node.status]}
          </button>
          {showStatusPickerFor === node.id && (
            <div className="absolute top-full right-0 z-50 mt-1">
              <StatusPicker
                current={node.status}
                onSelect={handleStatusSelect}
                onClose={() => setShowStatusPickerFor(null)}
              />
            </div>
          )}
        </div>

        {/* Link count */}
        {linkCount > 0 && (
          <span className="flex-shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
            {linkCount}
          </span>
        )}

        {/* Tag picker trigger */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowTagPickerFor(showTagPickerFor === node.id ? null : node.id)}
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
          {showTagPickerFor === node.id && (
            <TagPicker
              allTags={allTags}
              selectedTags={nodeTags}
              onAdd={(tag) => onAddTag(node.id, tag)}
              onRemove={(tagId) => onRemoveTag(node.id, tagId)}
              onCreateTag={onCreateTag}
              onClose={() => setShowTagPickerFor(null)}
            />
          )}
        </div>

        {/* Action menu */}
        <IdeaActionMenu
          idea={node}
          allIdeas={allIdeas}
          links={links}
          hasChildren={hasChildren}
          onEdit={() => setEditingId(node.id)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onSchedule={onSchedule}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onMove={onMove}
          hiddenActions={["link", "move"]}
        />
      </div>

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div>
          {node.children.map((child) => (
            <HorizonIdeaCard
              key={child.id}
              node={child}
              depth={depth + 1}
              allIdeas={allIdeas}
              allTags={allTags}
              links={links}
              editingId={editingId}
              setEditingId={setEditingId}
              showTagPickerFor={showTagPickerFor}
              setShowTagPickerFor={setShowTagPickerFor}
              showStatusPickerFor={showStatusPickerFor}
              setShowStatusPickerFor={setShowStatusPickerFor}
              getTagsForIdea={getTagsForIdea}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSchedule={onSchedule}
              onMove={onMove}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onCreateTag={onCreateTag}
              onToggleCollapse={onToggleCollapse}
              onExpandIdea={onExpandIdea}
            />
          ))}
        </div>
      )}
    </div>
  );
}
