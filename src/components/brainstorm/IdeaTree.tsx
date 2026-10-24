"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Focus as FocusIcon } from "lucide-react";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";
import {
  IdeaNode as IdeaNodeType,
  Idea,
  IdeaType,
  IdeaLink,
  Tag,
  LifeArea,
  LinkType,
} from "@/lib/types";
import { filterIdeaTree } from "@/lib/ideaTreeFilters";
import { getFocusedSubtreeIds } from "@/lib/ideaTreeFocus";
import { pruneTreeToIds } from "@/components/tree/filterTree";
import { TreeView, type ComposingState, type CreateIdeaPosition } from "@/components/tree";
import { getToday } from "@/lib/dateUtils";
import type { IdeasScope } from "@/hooks/useIdeas";
import { useAllPathStepSummaries } from "@/hooks/usePathStepSummary";
import { PathPreviewSvg } from "@/components/paths/PathPreviewSvg";
import { IdeaActionMenu } from "@/components/shared/IdeaActionMenu";
import { Waypoints } from "lucide-react";
import {
  LinkCountBadge,
  ScheduleChip,
  StatusIconSlot,
  StatusPillSlot,
  TagChipsSlot,
  TypeIconSlot,
  TypePillSlot,
} from "./ideaNodeSlots";

interface IdeaTreeProps {
  tree: IdeaNodeType[];
  ideas: Idea[];
  links: IdeaLink[];
  scope: IdeasScope;
  createIdea: (
    text: string,
    parentId?: string | null,
    position?: CreateIdeaPosition,
  ) => Promise<string>;
  updateIdea: (id: string, updates: Partial<Idea>) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  moveIdea: (id: string, newParentId: string | null, newSortOrder: number) => Promise<void>;
  onCreateParent?: (id: string, text: string, type: IdeaType) => Promise<string | null>;
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
  /** Optional tree filter; brainstorm no longer passes it (global search only). */
  search?: string;
  showType: boolean;
  showArea: boolean;
  editMode: "view" | "edit" | "insert";
  editingId: string | null;
  setEditingId: (v: string | null) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  composing: ComposingState | null;
  setComposing: (v: ComposingState | null) => void;
  showToday: boolean;
  hideClosed: boolean;
  hideCompleted: boolean;
  hideDeferred: boolean;
  /** Ids currently collapsed (drives synthetic nodes too — group + virtual paths). */
  collapsedIds?: Set<string>;
  /** Ids already triaged into Horizon — hidden, ancestors kept. */
  hideInHorizonIds?: Set<string>;
  /** Generic counterpart (e.g. pathed ids for the unpathed-only view). */
  hideIds?: Set<string>;
  /** Path titles per task id; renders small path chips in each row. */
  pathChipsForIdea?: (ideaId: string) => string[];
  typeFilter?: IdeaType[];
  focusedId: string | null;
  onFocus: (id: string | null) => void;
  cardMode?: boolean;
  /** Compact rows for narrow panes: hides type/area chips, keeps path chips. */
  compact?: boolean;
  /** Opt-in "add to path" handle (project split view); forwarded to TreeView. */
  onAddToPath?: (id: string) => void;
  isInPath?: (id: string) => boolean;
  pathAddDisabled?: boolean | ((id: string) => boolean);
  /** Open path editor drawer */
  onOpenPathDrawer?: (pathId: string) => void;
  groupUnassociatedPaths?: boolean;
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
      child.status !== "missed" &&
      child.status !== "archived"
    ) {
      return true;
    }
    if (hasActiveDescendant(child.id, ideas)) return true;
  }
  return false;
}

function collectTreeIds(nodes: IdeaNodeType[], acc: Set<string> = new Set<string>()): Set<string> {
  for (const node of nodes) {
    acc.add(node.id);
    collectTreeIds(node.children, acc);
  }
  return acc;
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
  onCreateParent,
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
  search = "",
  showType,
  showArea,
  editMode,
  editingId,
  setEditingId,
  selectedId,
  setSelectedId,
  composing,
  setComposing,
  showToday,
  hideClosed,
  hideCompleted,
  hideDeferred,
  collapsedIds,
  hideInHorizonIds,
  hideIds,
  pathChipsForIdea,
  typeFilter,
  focusedId,
  onFocus,
  cardMode,
  compact = false,
  onAddToPath,
  isInPath,
  pathAddDisabled,
  onOpenPathDrawer,
  groupUnassociatedPaths = false,
}: IdeaTreeProps) {
  const todayString = getToday();
  const [revealTarget, setRevealTarget] = useState<Idea | null>(null);
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const { openNotes } = useNotes();
  const pathSummaries = useAllPathStepSummaries();

  const presentation = useMemo(() => {
    const ideaById = new Map(ideas.map((idea) => [idea.id, idea]));
    const pathIdeas = ideas.filter((idea) => idea.type === "path");
    const associatedPathIds = new Set<string>();
    const virtualNodes: Idea[] = [];
    for (const link of links) {
      if (link.link_type !== "path_of") continue;
      const path = ideaById.get(link.source_id);
      const owner = ideaById.get(link.target_id);
      if (!path || path.type !== "path" || !owner || owner.type === "path") continue;
      associatedPathIds.add(path.id);
      virtualNodes.push({ ...path, parent_id: owner.id });
    }

    const virtualIds = new Set(virtualNodes.map((path) => path.id));
    const treeWithoutAssociatedPaths = (nodes: IdeaNodeType[]): IdeaNodeType[] =>
      nodes
        .filter((node) => !virtualIds.has(node.id))
        .map((node) => ({ ...node, children: treeWithoutAssociatedPaths(node.children) }));
    let baseTree = treeWithoutAssociatedPaths(tree);
    const baseIdeas = ideas.filter((idea) => !virtualIds.has(idea.id));
    if (groupUnassociatedPaths) {
      const unassociated = pathIdeas.filter((path) => !associatedPathIds.has(path.id));
      if (unassociated.length > 0) {
        const groupId = "__unassociated_paths__";
        const group: Idea = {
          id: groupId,
          user_id: unassociated[0].user_id,
          parent_id: null,
          text: "Unassociated paths",
          description: null,
          type: "idea",
          effort: null,
          impact: null,
          urgency: null,
          scheduled_date: null,
          scheduled_time: null,
          duration_minutes: null,
          is_priority: false,
          priority_order: null,
          status: "planned",
          notes: null,
          why: null,
          completed_at: null,
          cancelled_at: null,
          paused_at: null,
          attempt_dates: [],
          status_history: null,
          sort_order: Number.MAX_SAFE_INTEGER,
          created_at: "",
          updated_at: "",
        };
        baseIdeas.push(group);
        const groupNode: IdeaNodeType = {
          ...group,
          children: [],
          collapsed: collapsedIds?.has(groupId) ?? false,
        };
        const addGroupedPaths = (nodes: IdeaNodeType[]): IdeaNodeType[] =>
          nodes.map((node) => {
            if (node.id === groupId) return node;
            const children = addGroupedPaths(node.children);
            return { ...node, children };
          });
        baseTree = addGroupedPaths(baseTree);
        for (const path of unassociated) {
          const node = {
            ...path,
            parent_id: groupId,
            children: [],
            collapsed: collapsedIds?.has(path.id) ?? false,
          };
          groupNode.children.push(node);
          baseIdeas.push({ ...path, parent_id: groupId });
        }
        baseTree.push(groupNode);
      }
    }
    const fullIdeas = [...baseIdeas, ...virtualNodes];
    const withVirtualChildren = (nodes: IdeaNodeType[]): IdeaNodeType[] =>
      nodes.map((node) => ({
        ...node,
        children: [
          ...node.children,
          ...virtualNodes
            .filter((path) => path.parent_id === node.id)
            .map((path) => ({
              ...path,
              children: [],
              collapsed: collapsedIds?.has(path.id) ?? false,
            })),
        ].sort((a, b) => a.sort_order - b.sort_order),
      }));
    const allTree = withVirtualChildren(baseTree);
    const syntheticIds = new Set([
      ...virtualIds,
      ...(groupUnassociatedPaths && pathIdeas.some((path) => !associatedPathIds.has(path.id))
        ? ["__unassociated_paths__"]
        : []),
    ]);
    const filtered = filterIdeaTree(allTree, fullIdeas, {
      search,
      hideClosed,
      hideCompleted,
      hideDeferred,
      hideInHorizonIds,
      hideIds,
      typeFilter,
    });

    let result = filtered;
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
      for (const path of virtualNodes) {
        if (visibleIds.has(path.parent_id ?? "")) visibleIds.add(path.id);
      }
      if (groupUnassociatedPaths && pathIdeas.some((path) => !associatedPathIds.has(path.id))) {
        visibleIds.add("__unassociated_paths__");
        for (const path of pathIdeas) {
          if (!associatedPathIds.has(path.id)) visibleIds.add(path.id);
        }
      }
      result = pruneTreeToIds(result, visibleIds);
    }

    if (focusedId) {
      const focusIds = getFocusedSubtreeIds(focusedId, ideas);
      const treeIds = collectTreeIds(result);
      const visibleFocusIds = new Set<string>();
      for (const id of focusIds) {
        if (treeIds.has(id)) visibleFocusIds.add(id);
      }
      // Re-root at the focused node: pruneTreeToIds drops nested subtrees
      // when ancestors aren't in the set, so locate the node and return it.
      const findNode = (nodes: IdeaNodeType[]): IdeaNodeType | null => {
        for (const node of nodes) {
          if (node.id === focusedId) return node;
          const found = findNode(node.children);
          if (found) return found;
        }
        return null;
      };
      const focusedNode = visibleFocusIds.has(focusedId) ? findNode(result) : null;
      result = focusedNode
        ? [pruneTreeToIds([focusedNode], visibleFocusIds)[0] ?? focusedNode]
        : [];
    }

    return { tree: result, fullIdeas, syntheticIds };
  }, [
    tree,
    ideas,
    links,
    groupUnassociatedPaths,
    search,
    hideClosed,
    hideCompleted,
    hideDeferred,
    collapsedIds,
    hideInHorizonIds,
    hideIds,
    typeFilter,
    showToday,
    focusedId,
    todayString,
  ]);
  const filteredTree = presentation.tree;

  const labelClassName = (node: IdeaNodeType): string => {
    switch (node.status) {
      case "completed":
        return "text-violet-600/70 dark:text-violet-400/60";
      case "cancelled":
        return "text-red-400/60 dark:text-red-400/50";
      case "missed":
        return "text-rose-400/60 dark:text-rose-400/50";
      case "paused":
        return "text-orange-600/70 dark:text-orange-400/60";
      case "in_progress":
        return "text-amber-700 dark:text-amber-300";
      default:
        return "text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-3">
      <TreeView
        nodes={filteredTree}
        items={presentation.fullIdeas}
        className="space-y-0.5"
        onMove={moveIdea}
        onCreate={createIdea}
        onRename={(id, text) => updateIdea(id, { text })}
        onDelete={deleteIdea}
        onToggleCollapse={toggleCollapse}
        onExpand={expandIdea}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        editingId={editingId}
        setEditingId={setEditingId}
        composing={composing}
        setComposing={setComposing}
        getLabel={(idea) => idea.text}
        emptyLabel="empty"
        editPlaceholder="Type an idea..."
        onContextMenu={(node, e) => {
          e.preventDefault();
          setRevealTarget(node as Idea);
          setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        }}
        editBehavior={{
          deleteEmptyOnConfirm: true,
          deleteEmptyOnCancel: true,
          createChildOnTab: true,
        }}
        disableInsert={Boolean(search.trim()) || editMode === "view"}
        cardMode={cardMode}
        compact={compact}
        onAddToPath={onAddToPath}
        isInPath={isInPath}
        pathAddDisabled={pathAddDisabled}
        canExpand={(node) => node.type === "path"}
        isVirtualNode={(node) => presentation.syntheticIds.has(node.id)}
        onNodeLabelClick={(node) => {
          if (node.type === "path" && onOpenPathDrawer && editMode !== "edit") {
            onOpenPathDrawer(node.id);
            return true;
          }
          return false;
        }}
        renderCardBody={(node) =>
          node.type === "path" ? (
            <div className="my-1 w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50/50 p-1.5 dark:border-gray-800 dark:bg-gray-800/40">
              <PathPreviewSvg pathId={node.id} compact />
            </div>
          ) : null
        }
        renderAfterRow={(node) =>
          node.type === "path" && !node.collapsed && !cardMode ? (
            <div className="my-1.5 ml-6 overflow-hidden rounded-lg border border-gray-200/80 bg-gray-50/50 p-2 shadow-xs dark:border-gray-800 dark:bg-gray-800/30">
              <PathPreviewSvg pathId={node.id} />
            </div>
          ) : null
        }
        labelClassName={labelClassName}
        renderLeading={(node) => (
          <>
            {node.id === "__unassociated_paths__" ? (
              <span
                className="flex h-5 w-5 items-center justify-center text-violet-500"
                aria-hidden="true"
              >
                <Waypoints size={14} />
              </span>
            ) : null}
            <StatusIconSlot node={node} onMarkDone={onMarkDone} onMarkUndone={onMarkUndone} />
            {compact &&
              (node.type === "project" ? (
                <Link
                  href={`/projects?projectId=${node.id}`}
                  title="Open this project"
                  aria-label="Open this project"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                >
                  <TypeIconSlot node={node} />
                </Link>
              ) : (
                <TypeIconSlot node={node} />
              ))}
          </>
        )}
        renderTrailing={(node) => (
          <>
            <NotesIndicator
              hasNotes={!!node.notes?.trim()}
              onClick={() => openNotes(node.id)}
              size={11}
            />
            {showType && !compact && <TypePillSlot node={node} onUpdate={updateIdea} />}
            {showArea && !compact && (
              <TagChipsSlot
                node={node}
                allTags={allTags}
                getTagsForIdea={getTagsForIdea}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onCreateTag={onCreateTag}
              />
            )}
            <StatusPillSlot node={node} onUpdate={updateIdea} />
            <LinkCountBadge
              nodeId={node.id}
              links={links}
              stepSummary={node.type === "path" ? pathSummaries.get(node.id) : undefined}
              isPath={node.type === "path"}
            />
            {pathChipsForIdea?.(node.id).map((title) => (
              <span
                key={title}
                title={`In path: ${title}`}
                className="max-w-[110px] truncate rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
              >
                {title}
              </span>
            ))}
            <ScheduleChip node={node} todayString={todayString} />
            {focusedId !== node.id && (
              <button
                type="button"
                title="Focus on this idea and its subtree"
                aria-label="Focus on this idea and its subtree"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(node.id);
                }}
                className="flex flex-shrink-0 items-center text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
              >
                <FocusIcon size={12} strokeWidth={2} />
              </button>
            )}
            <IdeaActionMenu
              idea={node}
              allIdeas={ideas}
              links={links}
              hasChildren={node.children.length > 0}
              getTagsForIdea={getTagsForIdea}
              hiddenActions={editMode === "edit" ? [] : ["edit"]}
              onEdit={() => {
                if (node.type === "path" && onOpenPathDrawer) {
                  onOpenPathDrawer(node.id);
                } else {
                  setSelectedId(node.id);
                  setEditingId(node.id);
                }
              }}
              onDelete={deleteIdea}
              onSchedule={onSchedule}
              onCreateLink={onCreateLink}
              onDeleteLink={onDeleteLink}
              onMove={moveIdea}
              onCreateParent={onCreateParent}
              onMoved={(id) => {
                if (id) expandIdea(id);
              }}
              currentView="brainstorm"
            />
          </>
        )}
        inlineEditEnabled={editMode === "edit"}
        clickToInsert={editMode === "insert"}
        emptyMessage={
          <p className="py-4 text-sm text-gray-400 italic">
            {search
              ? "No matching ideas"
              : scope === "this_month"
                ? 'No ideas this month. Click "+ New idea" to add one, or switch to All to see everything.'
                : 'No ideas yet. Click "+ New idea" to start.'}
          </p>
        }
      />
      {revealTarget && revealPos && (
        <RevealInMenu
          idea={revealTarget}
          currentView="brainstorm"
          position={revealPos}
          onClose={() => setRevealTarget(null)}
          allIdeas={ideas}
          onAddToPath={onAddToPath ? () => onAddToPath(revealTarget.id) : undefined}
          isInPath={isInPath?.(revealTarget.id)}
          pathAddDisabled={
            typeof pathAddDisabled === "function"
              ? pathAddDisabled(revealTarget.id)
              : pathAddDisabled
          }
        />
      )}
    </div>
  );
}
