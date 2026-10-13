"use client";

import { useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Idea,
  IdeaLink,
  IdeaNode as IdeaNodeType,
  IdeaType,
  LifeArea,
  LinkType,
  Tag,
} from "@/lib/types";
import { type ComposingState, type CreateIdeaPosition, type TreeNode } from "@/components/tree";
import { TreeDnd } from "@/components/tree/useTreeDnd";
import { TreeProvider } from "@/components/tree/context";
import { TreeNodeRow } from "@/components/tree/TreeNodeRow";
import { type PriorityValue } from "@/components/shared/PriorityChip";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { useNotes } from "@/contexts/NotesContext";
import { SecondarySubGroup } from "@/components/horizon/SecondarySubGroup";
import { HorizonRowTrailing } from "@/components/horizon/HorizonRowTrailing";
import { PromotionTraces } from "@/components/horizon/PromotionTraces";
import { ComposingTypePill, PriorityChipSlot } from "@/components/horizon/slots/HorizonRowSlots";

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
  const linkCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of links) {
      map.set(l.source_id, (map.get(l.source_id) ?? 0) + 1);
      if (l.target_id !== l.source_id) map.set(l.target_id, (map.get(l.target_id) ?? 0) + 1);
    }
    return map;
  }, [links]);
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
      <HorizonRowTrailing
        node={node}
        ideas={ideas}
        links={links}
        linkCount={linkCountById.get(node.id) ?? 0}
        allTags={allTags}
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
        onEdit={() => setEditingId(node.id)}
        onOpenNotes={() => openNotes(node.id, { section: "context" })}
      />
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
    renderAfterRow: (node: IdeaNodeType) => (
      <PromotionTraces
        node={node}
        promotedByParent={promotedByParent}
        secondaryPromotedByParent={secondaryPromotedByParent}
        columnLabelByKey={columnLabelByKey}
        secondaryLabelByValue={secondaryLabelByValue}
        onJumpToChild={(childId, childColumnKey, stayInColumn) =>
          jumpToChild(childId, childColumnKey, stayInColumn ? { stayInColumn: true } : undefined)
        }
      />
    ),
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
