"use client";

import { useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
import { computeStatusUpdates } from "@/lib/tasks/statusTransition";
import { STATUS_LABELS, STATUS_STYLES, TYPE_BADGE } from "@/lib/constants";
import { type ComposingState, type CreateIdeaPosition, type TreeNode } from "@/components/tree";
import { TreeDnd } from "@/components/tree/useTreeDnd";
import { TreeProvider } from "@/components/tree/context";
import { TreeNodeRow } from "@/components/tree/TreeNodeRow";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { TypePicker } from "@/components/brainstorm/TypePicker";
import { TagPicker } from "@/components/shared/TagPicker";
import { PriorityChip, type PriorityValue } from "@/components/shared/PriorityChip";
import { HorizonQuickAssign } from "@/components/horizon/HorizonQuickAssign";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { TaskComposer } from "@/components/shared/TaskComposer";
import { useNotes } from "@/contexts/NotesContext";

function PriorityChipSlot({
  node,
  priorityValueOf,
  onSetPriority,
}: {
  node: IdeaNodeType;
  priorityValueOf: (ideaId: string) => PriorityValue;
  onSetPriority: (ideaId: string, value: string | null) => Promise<void>;
}) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex flex-shrink-0 items-center">
      <PriorityChip
        value={priorityValueOf(node.id)}
        onSelect={(v) => void onSetPriority(node.id, v)}
        usePortal
      />
    </span>
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
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const badge = node.type ? TYPE_BADGE[node.type] : null;
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPickerPos({ top: rect.bottom + 4, left: rect.left });
          setShowPicker(!showPicker);
        }}
        className={
          badge
            ? `rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge.className} cursor-pointer transition-opacity hover:opacity-80`
            : "rounded-full px-1.5 py-0 text-[10px] font-semibold text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
        }
      >
        {badge?.label ?? "Type"}
      </button>
      {showPicker && pickerPos && (
        <TypePicker
          current={node.type}
          onSelect={(type) => {
            void onUpdate(node.id, { type });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
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
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
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
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowPicker(!showPicker);
          }}
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
        {showPicker && pickerPos && (
          <TagPicker
            allTags={allTags}
            selectedTags={nodeTags}
            onAdd={(tag) => onAddTag(node.id, tag)}
            onRemove={(tagId) => onRemoveTag(node.id, tagId)}
            onCreateTag={onCreateTag}
            onClose={() => setShowPicker(false)}
            fixedPosition={pickerPos}
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
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);

  const handleStatusSelect = (status: IdeaStatus) => {
    void onUpdate(node.id, computeStatusUpdates(status));
    setShowPicker(false);
  };

  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPickerPos({ top: rect.bottom + 4, left: rect.left });
          setShowPicker(!showPicker);
        }}
        className={`cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${STATUS_STYLES[node.status]}`}
      >
        {STATUS_LABELS[node.status]}
      </button>
      {showPicker && pickerPos && (
        <StatusPicker
          current={node.status}
          onSelect={handleStatusSelect}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
        />
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
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const badge = TYPE_BADGE[type];
  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPickerPos({ top: rect.bottom + 4, left: rect.left });
          setShowPicker(!showPicker);
        }}
        className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${badge?.className ?? ""} cursor-pointer transition-opacity hover:opacity-80`}
      >
        {badge?.label ?? "Task"}
      </button>
      {showPicker && pickerPos && (
        <TypePicker
          current={type}
          onSelect={(next) => {
            const chosen = next ?? "task";
            setType(chosen);
            onSelect(chosen);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          position={pickerPos}
        />
      )}
    </div>
  );
}

function SecondarySubGroup({
  lensKey,
  groupValue,
  secondaryKey,
  secondaryValue,
  label,
  nodes,
  renderRows,
  onAddSecondary,
  suggestFrom,
  muted = false,
}: {
  lensKey: string;
  groupValue: string | null;
  secondaryKey: string;
  secondaryValue: string | null;
  label: string;
  nodes: TreeNode<Idea>[];
  renderRows: (rows: TreeNode<Idea>[]) => React.ReactNode;
  onAddSecondary?: (text: string, type: IdeaType, secondaryValue: string | null) => Promise<void>;
  suggestFrom?: Idea[];
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group:${lensKey}:${groupValue ?? "null"}:${secondaryKey}:${secondaryValue ?? "null"}`,
  });
  const [draftType, setDraftType] = useState<IdeaType>("task");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState<{ top: number; left: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      className={`mx-2 rounded-xl border border-black/[0.04] dark:border-white/[0.06] ${isOver ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "bg-black/[0.015] dark:bg-white/[0.015]"}`}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase ${muted ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"}`}
        >
          {label}
        </span>
        <span className="rounded-full bg-black/[0.04] px-1.5 py-0 text-[10px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
          {nodes.length}
        </span>
      </div>
      {nodes.length > 0 ? (
        renderRows(nodes)
      ) : (
        <p className="px-3 pb-1 text-[11px] text-gray-400 italic dark:text-gray-500">
          Drop here or add below
        </p>
      )}
      {onAddSecondary && (
        <div className="flex items-center gap-1.5 border-t border-black/[0.04] px-3 py-1.5 dark:border-white/[0.06]">
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTypePickerPos({ top: rect.bottom + 4, left: rect.left });
                setShowTypePicker(!showTypePicker);
              }}
              className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${TYPE_BADGE[draftType].className} cursor-pointer transition-opacity hover:opacity-80`}
            >
              {TYPE_BADGE[draftType].label}
            </button>
            {showTypePicker && typePickerPos && (
              <TypePicker
                current={draftType}
                onSelect={(type) => {
                  setDraftType(type ?? "task");
                  setShowTypePicker(false);
                }}
                onClose={() => setShowTypePicker(false)}
                position={typePickerPos}
              />
            )}
          </div>
          <QuickAddInline
            secondaryValue={secondaryValue}
            draftType={draftType}
            onAdd={onAddSecondary}
            suggestFrom={suggestFrom}
          />
        </div>
      )}
    </div>
  );
}

function QuickAddInline({
  secondaryValue,
  draftType,
  onAdd,
  suggestFrom,
}: {
  secondaryValue: string | null;
  draftType: IdeaType;
  onAdd: (text: string, type: IdeaType, secondaryValue: string | null) => Promise<void>;
  suggestFrom?: Idea[];
}) {
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <TaskComposer
        variant="plain"
        placeholder="+ Add..."
        onCreate={(trimmed) => onAdd(trimmed, draftType, secondaryValue)}
        suggestFrom={suggestFrom}
      />
    </div>
  );
}

export interface SecondaryOption {
  key: string;
  label: string;
}

export interface HorizonTreeProps {
  nodes: TreeNode<Idea>[];
  ideas: Idea[];
  /** Active classification lens key (e.g. "term", "nnl") for drag-and-drop grouping. */
  lensKey: string;
  /** Option value this column shows; null = the explicit unclassified group. */
  groupValue: string | null;
  onSetValue: (id: string, value: string | null) => Promise<void>;
  /** Optional secondary split within this column. Null = flat list (legacy). */
  secondaryKey?: string | null;
  secondaryOptions?: SecondaryOption[];
  secondaryLabel?: string;
  secondaryValueOf?: (ideaId: string) => string | null;
  onSetSecondary?: (id: string, value: string | null) => Promise<void>;
  onAddSecondary?: (text: string, type: IdeaType, secondaryValue: string | null) => Promise<void>;
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
  /** Priority scheme value lookup + setter (chip works regardless of active lens). */
  priorityValueOf: (ideaId: string) => PriorityValue;
  onSetPriority: (ideaId: string, value: string | null) => Promise<void>;
  emptyMessage?: React.ReactNode;
  cardMode?: boolean;
  /** Render as a collapsed strip (label + count); click expands. Drops still land. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  groupLabel?: string;
  /** Parent id -> promoted direct children (own column differs from parent). */
  promotedByParent?: Map<string, { id: string; columnKey: string }[]>;
  /** Column key -> label, for trace/breadcrumb text. */
  columnLabelByKey?: Map<string, string>;
  /** Pre-grouped secondary subgroups (after secondary promotion). */
  secondaryGrouped?: Map<string | null, TreeNode<Idea>[]>;
  /** Parent id -> secondary-promoted children (same primary column). */
  secondaryPromotedByParent?: Map<string, { id: string; columnKey: string }[]>;
  /** Secondary value -> label, for trace text. */
  secondaryLabelByValue?: Map<string, string>;
}

export function HorizonTree({
  nodes,
  ideas,
  lensKey,
  groupValue,
  onSetValue,
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
  priorityValueOf,
  onSetPriority,
  emptyMessage,
  cardMode,
  collapsed = false,
  onToggleCollapsed,
  groupLabel = "Unclassified",
  secondaryKey = null,
  secondaryOptions = [],
  secondaryValueOf,
  onSetSecondary,
  onAddSecondary,
  promotedByParent,
  columnLabelByKey,
  secondaryGrouped,
  secondaryPromotedByParent,
  secondaryLabelByValue,
}: HorizonTreeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composing, setComposing] = useState<ComposingState | null>(null);
  const [revealTarget, setRevealTarget] = useState<Idea | null>(null);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const { openNotes } = useNotes();
  const { setNodeRef, isOver } = useDroppable({ id: `group:${lensKey}:${groupValue ?? "null"}` });

  const hasSecondary = !!secondaryKey && !!onSetSecondary;
  const secondaryOf = secondaryValueOf ?? (() => null);

  const handleGroupDrop = (draggedId: string, value: string | null) => {
    void onSetValue(draggedId, value);
  };

  const handleSecondaryDrop = (draggedId: string, _key: string, value: string | null) => {
    if (onSetSecondary) void onSetSecondary(draggedId, value);
  };

  const ideasById = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas]);
  const topLevelIds = useMemo(() => {
    if (secondaryGrouped) return new Set([...secondaryGrouped.values()].flat().map((n) => n.id));
    return new Set(nodes.map((n) => n.id));
  }, [nodes, secondaryGrouped]);

  const jumpToChild = (
    childId: string,
    childColumnKey: string,
    opts?: { stayInColumn?: boolean },
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lens", lensKey);
    if (!opts?.stayInColumn) params.set("horizon", childColumnKey);
    params.set("highlight", childId);
    router.replace(`/horizon?${params.toString()}`, { scroll: false });
    // Local scroll fallback (page effect also handles ?highlight=).
    window.setTimeout(() => {
      const el = document.getElementById(`idea-${childId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-pulse");
        window.setTimeout(() => el.classList.remove("highlight-pulse"), 2500);
      }
    }, 150);
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
    renderLeading: (node: IdeaNodeType) => (
      <PriorityChipSlot
        node={node}
        priorityValueOf={priorityValueOf}
        onSetPriority={onSetPriority}
      />
    ),
    renderTrailing: (node: IdeaNodeType) => (
      <>
        <NotesIndicator hasNotes={!!node.notes?.trim()} onClick={() => openNotes(node.id)} />
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
        <HorizonQuickAssign node={node} onUpdate={onUpdate} />
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
          getTagsForIdea={getTagsForIdea}
          onEdit={() => setEditingId(node.id)}
          onDelete={onDelete}
          onSchedule={onSchedule}
          onCreateLink={onCreateLink}
          onDeleteLink={onDeleteLink}
          onMove={onMove}
          hiddenActions={["move"]}
          onShowDetails={() => openNotes(node.id, { section: "context" })}
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
    renderSubtitle: (node: IdeaNodeType) => {
      if (!node.parent_id || !topLevelIds.has(node.id)) return null;
      const parent = ideasById.get(node.parent_id);
      if (!parent) return null;
      return (
        <div className="truncate px-9 text-[11px] text-gray-400 italic dark:text-gray-500">
          ↳ {parent.text || "Untitled"}
        </div>
      );
    },
    renderAfterRow: (node: IdeaNodeType) => {
      const refs = promotedByParent?.get(node.id) ?? [];
      const secRefs = secondaryPromotedByParent?.get(node.id) ?? [];
      if (refs.length === 0 && secRefs.length === 0) return null;
      const byColumn = new Map<
        string,
        { ref: { id: string; columnKey: string }; secondary: boolean }[]
      >();
      for (const r of refs) {
        const list = byColumn.get(`p:${r.columnKey}`) ?? [];
        list.push({ ref: r, secondary: false });
        byColumn.set(`p:${r.columnKey}`, list);
      }
      for (const r of secRefs) {
        const list = byColumn.get(`s:${r.columnKey}`) ?? [];
        list.push({ ref: r, secondary: true });
        byColumn.set(`s:${r.columnKey}`, list);
      }
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-9 py-0.5">
          {[...byColumn.entries()].map(([key, list]) => {
            const { ref: first, secondary } = list[0];
            const label = secondary
              ? (secondaryLabelByValue?.get(first.columnKey) ?? first.columnKey)
              : (columnLabelByKey?.get(first.columnKey) ?? first.columnKey);
            const text =
              list.length === 1 ? `1 child in ${label}` : `${list.length} children in ${label}`;
            return (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  jumpToChild(
                    first.id,
                    first.columnKey,
                    secondary ? { stayInColumn: true } : undefined,
                  );
                }}
                title={`Jump to ${label}`}
                className="cursor-pointer text-[11px] text-gray-400 italic hover:text-indigo-500 hover:underline dark:text-gray-500"
              >
                ↳ {text}
              </button>
            );
          })}
        </div>
      );
    },
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

  if (!collapsed && nodes.length === 0 && emptyMessage) {
    return <div>{emptyMessage}</div>;
  }

  const renderRows = (rows: TreeNode<Idea>[]) => (
    <div>
      {rows.map((node, index) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          depth={0}
          isLastSibling={index === rows.length - 1}
        />
      ))}
    </div>
  );

  const renderContent = () => {
    if (nodes.length === 0) {
      return (
        <p className="px-4 py-2 text-center text-xs text-gray-400 italic dark:text-gray-500">
          Empty
        </p>
      );
    }
    if (!hasSecondary) return renderRows(nodes);
    const grouped =
      secondaryGrouped ??
      (() => {
        const m = new Map<string | null, TreeNode<Idea>[]>();
        for (const node of nodes) {
          const v = secondaryOf(node.id);
          const list = m.get(v) ?? [];
          list.push(node);
          m.set(v, list);
        }
        return m;
      })();
    const unclassified = grouped.get(null) ?? [];
    return (
      <div className="flex flex-col gap-1 py-1">
        {secondaryOptions.map((opt) => (
          <SecondarySubGroup
            key={opt.key}
            lensKey={lensKey}
            groupValue={groupValue}
            secondaryKey={secondaryKey!}
            secondaryValue={opt.key}
            label={opt.label}
            nodes={grouped.get(opt.key) ?? []}
            renderRows={renderRows}
            onAddSecondary={onAddSecondary}
            suggestFrom={ideas}
          />
        ))}
        {unclassified.length > 0 && (
          <SecondarySubGroup
            lensKey={lensKey}
            groupValue={groupValue}
            secondaryKey={secondaryKey!}
            secondaryValue={null}
            label="Unclassified"
            nodes={unclassified}
            renderRows={renderRows}
            onAddSecondary={onAddSecondary}
            suggestFrom={ideas}
            muted
          />
        )}
      </div>
    );
  };

  return (
    <>
      <TreeDnd
        items={ideas}
        onMove={onMove}
        getLabel={(idea) => idea.text}
        onGroupDrop={handleGroupDrop}
        onSecondaryGroupDrop={handleSecondaryDrop}
      >
        <TreeProvider value={{ controller, ui, options: treeOptions }}>
          <div
            ref={setNodeRef}
            className={`min-h-[48px] ${isOver ? "bg-indigo-50/50 dark:bg-indigo-500/5" : ""}`}
          >
            {collapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                title={`Expand to show ${groupLabel.toLowerCase()} ideas (drop here to unclassify)`}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {groupLabel}
                  </span>
                  <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
                    {nodes.length}
                  </span>
                </span>
                <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
              </button>
            ) : (
              renderContent()
            )}
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
