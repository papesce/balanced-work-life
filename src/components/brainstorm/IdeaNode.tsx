"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Link2,
  ArrowUpDown,
  Calendar,
  Trash2,
  MoreHorizontal,
  Pencil,
  Telescope,
  Check,
  Plus,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  IdeaNode as IdeaNodeType,
  Idea,
  IdeaLink,
  IdeaType,
  IdeaHorizon,
  Tag,
  LinkType,
  IdeaStatus,
  LifeArea,
} from "@/lib/types";
import { TypePicker } from "./TypePicker";
import { TagPicker } from "@/components/shared/TagPicker";
import { AREA_DOT_COLORS, STATUS_CONFIG } from "@/lib/constants";
import { StatusPicker } from "./StatusPicker";
import { LinkPanel } from "./LinkPanel";
import { IdeaComposer } from "./IdeaComposer";
import { MoveIdeaPanel } from "./MoveIdeaPanel";
import { SchedulePicker } from "./SchedulePicker";

interface IdeaNodeProps {
  node: IdeaNodeType;
  depth: number;
  showType: boolean;
  showArea: boolean;
  search: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  composing: {
    nodeId: string;
    parentId: string | null;
    position: "child" | "top" | "bottom";
    depth: number;
  } | null;
  setComposing: (
    v: {
      nodeId: string;
      parentId: string | null;
      position: "child" | "top" | "bottom";
      depth: number;
    } | null,
  ) => void;
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
  allIdeas: Idea[];
  links: IdeaLink[];
  onCreateLink: (sourceId: string, targetId: string, linkType: LinkType) => Promise<string>;
  onDeleteLink: (id: string) => Promise<void>;
  onMarkDone: (id: string) => Promise<void>;
  onMarkUndone: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  todayString: string;
  isAncestorOnly?: boolean;
  // Tag-related props
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}

function formatScheduleDate(date: string, today: string): string {
  if (date === today) return "Hoy";
  const tomorrow = new Date(today + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().split("T")[0]) return "Mañana";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
}

const TYPE_COLORS: Record<IdeaType, string> = {
  idea: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/30",
  objective:
    "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/30",
  project:
    "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/30",
  initiative:
    "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30",
  task: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/30",
};

const STATUS_STYLES: Record<IdeaStatus, string> = {
  inbox: "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent",
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
  inbox: "Draft",
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

export function IdeaNode({
  node,
  depth,
  showType,
  showArea,
  search,
  editingId,
  setEditingId,
  selectedId,
  setSelectedId,
  composing,
  setComposing,
  createIdea,
  updateIdea,
  deleteIdea,
  moveIdea,
  toggleCollapse,
  expandIdea,
  allIdeas,
  links,
  onCreateLink,
  onDeleteLink,
  onMarkDone,
  onMarkUndone,
  onSchedule,
  todayString,
  isAncestorOnly,
  allTags,
  getTagsForIdea,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: IdeaNodeProps) {
  const router = useRouter();
  const nodeTags = getTagsForIdea(node.id);
  const isEditing = editingId === node.id;
  const isSelected = selectedId === node.id;
  const [editText, setEditText] = useState(node.text);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [dragOver, setDragOver] = useState<"top" | "center" | "bottom" | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showHorizonPicker, setShowHorizonPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const linkCount = links.filter((l) => l.source_id === node.id || l.target_id === node.id).length;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const hasChildren = node.children.length > 0;

  const isDescendant = (possibleDescendantId: string, ancestorId: string): boolean => {
    const possibleDescendant = allIdeas.find((idea) => idea.id === possibleDescendantId);
    if (!possibleDescendant?.parent_id) return false;
    if (possibleDescendant.parent_id === ancestorId) return true;
    return isDescendant(possibleDescendant.parent_id, ancestorId);
  };

  const handleStartEdit = () => {
    setSelectedId(node.id);
    setEditText(node.text);
    setEditingId(node.id);
  };

  const handleConfirmEdit = () => {
    if (editText.trim() || node.text) {
      updateIdea(node.id, { text: editText.trim() || node.text });
    } else {
      deleteIdea(node.id);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    if (!node.text && !editText.trim()) {
      deleteIdea(node.id);
    }
    setEditingId(null);
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleConfirmEdit();
      const childId = await createIdea("", node.id, "top");
      if (node.collapsed) toggleCollapse(node.id);
      if (childId) {
        setSelectedId(childId);
        setEditingId(childId);
      }
    }
  };

  const handleCreateChild = async (text: string) => {
    const parentId = composing?.parentId ?? node.id;
    const position = composing?.position === "child" ? "top" : (composing?.position ?? "top");
    const childId = await createIdea(text, parentId, position);
    if (parentId === node.id && node.collapsed) toggleCollapse(node.id);
    setComposing(null);
    if (childId) setSelectedId(childId);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = rowRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const third = rect.height / 3;
    if (y < third) setDragOver("top");
    else if (y > third * 2) setDragOver("bottom");
    else setDragOver("center");
  };

  const handleDragLeave = () => setDragOver(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId === node.id) return;
    setDragOver(null);

    if (dragOver === "center") {
      if (isDescendant(node.id, draggedId)) return;
      moveIdea(draggedId, node.id, 0);
    } else if (dragOver === "top") {
      if (
        node.parent_id === draggedId ||
        (node.parent_id && isDescendant(node.parent_id, draggedId))
      )
        return;
      moveIdea(draggedId, node.parent_id, node.sort_order);
    } else if (dragOver === "bottom") {
      if (
        node.parent_id === draggedId ||
        (node.parent_id && isDescendant(node.parent_id, draggedId))
      )
        return;
      moveIdea(draggedId, node.parent_id, node.sort_order + 1);
    }
  };

  const handleMove = async (newParentId: string | null, newSortOrder: number) => {
    await moveIdea(node.id, newParentId, newSortOrder);
    setSelectedId(node.id);
  };

  const handleMoved = (parentIdToExpand: string | null) => {
    if (!parentIdToExpand) return;
    expandIdea(parentIdToExpand);
  };

  const handleStatusSelect = async (status: IdeaStatus) => {
    const now = new Date().toISOString();
    setShowStatusPicker(false);
    try {
      switch (status) {
        case "completed":
          await updateIdea(node.id, { status: "completed", completed_at: now });
          break;
        case "cancelled":
          await updateIdea(node.id, { status: "cancelled", cancelled_at: now });
          break;
        case "in_progress":
          await updateIdea(node.id, { status: "in_progress" });
          break;
        case "paused":
          await updateIdea(node.id, { status: "paused", paused_at: now });
          break;
        case "planned":
        case "scheduled":
        case "draft":
        case "inbox":
          await updateIdea(node.id, {
            status,
            completed_at: null,
            cancelled_at: null,
            paused_at: null,
          });
          break;
        case "archived":
          await updateIdea(node.id, { status: "archived" });
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      window.alert(`Couldn't change status to "${status}": ${message}`);
    }
  };

  const handleRequestDelete = () => {
    setShowMenu(false);
    setShowStatusPicker(false);
    setShowMovePanel(false);
    setShowLinkPanel(false);
    setShowSchedulePicker(false);
    setShowDeleteWarning(true);
  };

  const handleConfirmDelete = async () => {
    await deleteIdea(node.id);
    setShowDeleteWarning(false);
  };

  const matchesSearch = (n: IdeaNodeType): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (n.text.toLowerCase().includes(q)) return true;
    return n.children.some(matchesSearch);
  };

  const isAnyMenuOpen =
    showMenu ||
    showTypePicker ||
    showTagPicker ||
    showStatusPicker ||
    showLinkPanel ||
    showMovePanel ||
    showSchedulePicker ||
    showHorizonPicker;

  return (
    <div className="relative" style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      {/* Separator bar - always in DOM, absolutely positioned to avoid layout shifts */}
      {!search && !isEditing && (
        <div
          className="pointer-events-none absolute -top-2 right-0 left-0 z-10"
          style={{ height: 16 }}
        >
          <div
            className="pointer-events-auto absolute inset-x-0 top-1/2 -translate-y-1/2 cursor-pointer opacity-0 transition-opacity hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setComposing({
                nodeId: node.id,
                parentId: node.parent_id ?? null,
                position: "top",
                depth,
              });
            }}
          >
            <div className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-1 dark:bg-indigo-500/10">
              <div className="h-[2px] flex-1 rounded-full bg-indigo-300 dark:bg-indigo-500" />
              <Plus
                size={12}
                className="flex-shrink-0 text-indigo-400 dark:text-indigo-400"
                strokeWidth={2.5}
              />
              <div className="h-[2px] flex-1 rounded-full bg-indigo-300 dark:bg-indigo-500" />
            </div>
          </div>
        </div>
      )}

      <div
        ref={rowRef}
        className={`group flex items-center gap-1 rounded-md px-1 py-1 ${
          dragOver === "top"
            ? "border-t-2 border-indigo-400"
            : dragOver === "bottom"
              ? "border-b-2 border-indigo-400"
              : dragOver === "center"
                ? "bg-indigo-50 dark:bg-indigo-500/10"
                : isSelected
                  ? "bg-indigo-50/60 dark:bg-indigo-500/10"
                  : ""
        } ${isAnyMenuOpen ? "relative z-30" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(isSelected ? null : node.id);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleCollapse(node.id);
          }}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-gray-400 hover:text-gray-600"
        >
          {hasChildren ? (
            node.collapsed ? (
              <ChevronRight size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )
          ) : null}
        </button>

        {/* Add child button - appears on hover */}
        {!search && !isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setComposing({
                nodeId: node.id,
                parentId: node.id,
                position: "child",
                depth: depth + 1,
              });
            }}
            title="Add child idea"
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        )}

        {/* Drag handle */}
        <span
          draggable
          onDragStart={handleDragStart}
          className="flex flex-shrink-0 cursor-grab items-center text-gray-300 select-none hover:text-gray-500"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </span>

        {/* Status icon */}
        {!isAncestorOnly && STATUS_CONFIG[node.status].icon && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (node.status === "completed" || node.status === "cancelled") {
                onMarkUndone(node.id);
              } else {
                onMarkDone(node.id);
              }
            }}
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${STATUS_CONFIG[node.status].textClass}`}
          >
            {(() => {
              const Icon = STATUS_CONFIG[node.status].icon;
              return Icon ? <Icon size={14} strokeWidth={2.5} /> : null;
            })()}
          </button>
        )}

        {/* Text */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirmEdit}
            className="max-w-sm min-w-0 flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm outline-none focus:border-indigo-500"
            placeholder="Type an idea..."
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            className={`max-w-sm min-w-0 flex-1 truncate rounded px-2 py-0.5 text-sm ${
              isAncestorOnly
                ? "cursor-default text-gray-400 italic"
                : node.status === "completed"
                  ? "cursor-text text-violet-600/70 hover:bg-gray-100 dark:text-violet-400/60 dark:hover:bg-white/[0.04]"
                  : node.status === "cancelled"
                    ? "cursor-text text-red-400/60 hover:bg-gray-100 dark:text-red-400/50 dark:hover:bg-white/[0.04]"
                    : node.status === "paused"
                      ? "cursor-text text-orange-600/70 hover:bg-gray-100 dark:text-orange-400/60 dark:hover:bg-white/[0.04]"
                      : node.status === "in_progress"
                        ? "cursor-text text-amber-700 hover:bg-gray-100 dark:text-amber-300 dark:hover:bg-white/[0.04]"
                        : "cursor-text text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.04]"
            }`}
          >
            {node.text || <span className="text-gray-400 italic">empty</span>}
          </span>
        )}

        {/* Type pill */}
        {showType && (
          <div
            className="relative w-20 flex-shrink-0 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowTypePicker(!showTypePicker)}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                node.type ? TYPE_COLORS[node.type] : "border-gray-200 text-gray-400"
              }`}
            >
              {node.type ? node.type.charAt(0).toUpperCase() + node.type.slice(1) : "—"}
            </button>
            {showTypePicker && (
              <TypePicker
                current={node.type}
                onSelect={(type) => {
                  updateIdea(node.id, { type });
                  setShowTypePicker(false);
                }}
                onClose={() => setShowTypePicker(false)}
              />
            )}
          </div>
        )}

        {/* Tag chips */}
        {showArea && (
          <div
            className="relative flex min-w-28 flex-shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {nodeTags.map((tag) => (
              <span
                key={tag.id}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                  AREA_DOT_COLORS[tag.area] ? "border-current/20" : "border-gray-200 text-gray-400"
                }`}
                style={{ opacity: 0.85 }}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${AREA_DOT_COLORS[tag.area]}`}
                />
                {tag.name}
              </span>
            ))}
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="rounded-full border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-500 dark:hover:text-gray-300"
              title="Add tag"
            >
              {nodeTags.length === 0 ? "tag" : "+"}
            </button>
            {showTagPicker && (
              <TagPicker
                allTags={allTags}
                selectedTags={nodeTags}
                onAdd={(tag) => {
                  void onAddTag(node.id, tag);
                }}
                onRemove={(tagId) => {
                  void onRemoveTag(node.id, tagId);
                }}
                onCreateTag={onCreateTag}
                onClose={() => setShowTagPicker(false)}
              />
            )}
          </div>
        )}

        {/* Status pill */}
        {!isAncestorOnly && (
          <div
            className="relative w-20 flex-shrink-0 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                STATUS_STYLES[node.status]
              }`}
            >
              {STATUS_LABELS[node.status]}
            </button>
            {showStatusPicker && (
              <div className="absolute top-full right-0 z-50 mt-1">
                <StatusPicker
                  current={node.status}
                  onSelect={handleStatusSelect}
                  onClose={() => setShowStatusPicker(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Link count badge */}
        {linkCount > 0 && (
          <span className="flex-shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
            {linkCount}
          </span>
        )}

        {/* Scheduled date chip */}
        {node.scheduled_date && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/timeline?date=${node.scheduled_date}&highlight=${node.id}`);
            }}
            title="Open in timeline"
            className={`flex w-20 flex-shrink-0 items-center justify-center truncate rounded-full border px-1.5 py-0.5 text-xs transition-colors hover:border-violet-400 hover:text-violet-700 dark:hover:border-violet-500 dark:hover:text-violet-300 ${
              node.scheduled_date === todayString
                ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300"
                : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
            }`}
          >
            {formatScheduleDate(node.scheduled_date, todayString)}
          </button>
        )}

        {/* Actions kebab menu */}
        <div
          className="relative flex flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            ref={menuTriggerRef}
            onClick={() => {
              if (showMenu) {
                setShowMenu(false);
                return;
              }
              const rect = menuTriggerRef.current?.getBoundingClientRect();
              if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              setShowMenu(true);
            }}
            title="Actions"
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
              showMenu
                ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
          {showMenu &&
            menuPos &&
            createPortal(
              <div
                ref={menuRef}
                style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    handleStartEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Pencil size={12} strokeWidth={1.5} />
                  Edit
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowLinkPanel(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Link2 size={12} strokeWidth={1.5} />
                  Link
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowMovePanel(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <ArrowUpDown size={12} strokeWidth={1.5} />
                  Move
                </button>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowSchedulePicker(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    <Calendar size={12} strokeWidth={1.5} />
                    Schedule
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowHorizonPicker(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Telescope size={12} strokeWidth={1.5} />
                  Horizon
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={handleRequestDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                  Delete
                </button>
              </div>,
              document.body,
            )}
        </div>

        {/* Horizon picker flyout */}
        {showHorizonPicker &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPos.top,
                right: menuPos.right + 200,
                zIndex: 9999,
              }}
              className="glass-card-strong min-w-[160px] rounded-xl py-1.5 shadow-lg"
            >
              <p className="px-3 py-1 text-[10px] font-medium tracking-wide text-gray-400 uppercase">
                Move to horizon
              </p>
              {(["short", "medium", "long"] as IdeaHorizon[]).map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    updateIdea(node.id, { horizon: h });
                    setShowHorizonPicker(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <span className="w-3">
                    {node.horizon === h && <Check size={12} strokeWidth={2} />}
                  </span>
                  {h === "short" ? "Short-term" : h === "medium" ? "Medium-term" : "Long-term"}
                </button>
              ))}
              {node.horizon != null && (
                <>
                  <div className="my-1 border-t border-black/5 dark:border-white/5" />
                  <button
                    onClick={() => {
                      updateIdea(node.id, { horizon: null });
                      setShowHorizonPicker(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    <span className="w-3" />
                    Remove from horizon
                  </button>
                </>
              )}
            </div>,
            document.body,
          )}

        {/* Sub-panels opened from menu */}
        {showLinkPanel && (
          <LinkPanel
            ideaId={node.id}
            ideas={allIdeas}
            links={links}
            onCreateLink={onCreateLink}
            onDeleteLink={onDeleteLink}
            onClose={() => setShowLinkPanel(false)}
          />
        )}
        {showMovePanel && (
          <MoveIdeaPanel
            idea={node}
            ideas={allIdeas}
            onMove={handleMove}
            onMoved={handleMoved}
            onClose={() => setShowMovePanel(false)}
          />
        )}
        {showSchedulePicker && (
          <div className="relative">
            <SchedulePicker
              currentDate={node.scheduled_date}
              onSelect={(date) => {
                onSchedule(node.id, date);
                setShowSchedulePicker(false);
              }}
              onClear={() => {
                onSchedule(node.id, null);
                setShowSchedulePicker(false);
              }}
              onClose={() => setShowSchedulePicker(false)}
            />
          </div>
        )}
        {showDeleteWarning && (
          <div className="glass-card-strong absolute top-7 right-0 z-20 w-52 rounded-xl border border-red-200 p-2 dark:border-red-500/30">
            <p className="text-xs font-medium text-red-700 dark:text-red-400">Delete this idea?</p>
            {hasChildren && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Child ideas will be deleted too.
              </p>
            )}
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                onClick={() => setShowDeleteWarning(false)}
                className="rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {composing?.nodeId === node.id && !search && !node.collapsed && editingId !== node.id && (
        <IdeaComposer
          depth={composing.depth}
          placeholder={composing.position === "child" ? "Add child idea..." : "Add idea..."}
          onCreate={handleCreateChild}
          onDismiss={() => setComposing(null)}
        />
      )}

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div>
          {node.children
            .filter((child) => matchesSearch(child))
            .map((child) => (
              <IdeaNode
                key={child.id}
                node={child}
                depth={depth + 1}
                showType={showType}
                showArea={showArea}
                search={search}
                editingId={editingId}
                setEditingId={setEditingId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                composing={composing}
                setComposing={setComposing}
                createIdea={createIdea}
                updateIdea={updateIdea}
                deleteIdea={deleteIdea}
                moveIdea={moveIdea}
                toggleCollapse={toggleCollapse}
                expandIdea={expandIdea}
                allIdeas={allIdeas}
                links={links}
                onCreateLink={onCreateLink}
                onDeleteLink={onDeleteLink}
                onMarkDone={onMarkDone}
                onMarkUndone={onMarkUndone}
                onSchedule={onSchedule}
                todayString={todayString}
                isAncestorOnly={isAncestorOnly}
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
