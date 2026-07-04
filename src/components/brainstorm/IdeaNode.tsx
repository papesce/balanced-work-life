"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ChevronRight, ChevronDown, GripVertical, Link2, ArrowUpDown, Calendar, Trash2, Play, Pause, Check, X } from "lucide-react";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, IdeaType, Tag, LinkType, IdeaStatus, LifeArea } from "@/lib/types";
import { TypePicker } from "./TypePicker";
import { TagPicker, AREA_DOT_COLORS } from "@/components/shared/TagPicker";
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
  createIdea: (text: string, parentId?: string | null, position?: "top" | "bottom") => Promise<string>;
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
  objective: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/30",
  project: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/30",
  initiative: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30",
  task: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/30",
};


const STATUS_STYLES: Record<IdeaStatus, string> = {
  inbox: "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent",
  planned: "border-sky-200 dark:border-sky-700/30 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
  scheduled: "border-blue-200 dark:border-blue-700/30 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  in_progress: "border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  paused: "border-orange-200 dark:border-orange-700/30 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
  completed: "border-violet-200 dark:border-violet-700/30 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300",
  cancelled: "border-red-200 dark:border-red-700/30 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
  archived: "border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-transparent",
};

const STATUS_LABELS: Record<IdeaStatus, string> = {
  inbox: "Inbox",
  planned: "Planned",
  scheduled: "Scheduled",
  in_progress: "Active",
  paused: "Paused",
  completed: "Done",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_ICON: Record<IdeaStatus, { icon: React.ElementType | null; color: string }> = {
  inbox:       { icon: null, color: "text-gray-400" },
  planned:     { icon: null, color: "text-sky-500" },
  scheduled:   { icon: null, color: "text-blue-500" },
  in_progress: { icon: Play, color: "text-amber-500" },
  paused:      { icon: Pause, color: "text-orange-400" },
  completed:   { icon: Check, color: "text-violet-600" },
  cancelled:   { icon: X,     color: "text-red-500" },
  archived:    { icon: null, color: "text-gray-400" },
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
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const linkCount = links.filter(
    (l) => l.source_id === node.id || l.target_id === node.id
  ).length;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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
    const childId = await createIdea(text, node.id, "top");
    if (node.collapsed) toggleCollapse(node.id);
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
      if (node.parent_id === draggedId || (node.parent_id && isDescendant(node.parent_id, draggedId))) return;
      moveIdea(draggedId, node.parent_id, node.sort_order);
    } else if (dragOver === "bottom") {
      if (node.parent_id === draggedId || (node.parent_id && isDescendant(node.parent_id, draggedId))) return;
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
        case "inbox":
          await updateIdea(node.id, { status, completed_at: null, cancelled_at: null, paused_at: null });
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

  const isAnyMenuOpen = showTypePicker || showTagPicker || showStatusPicker || showLinkPanel || showMovePanel || showSchedulePicker;

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      <div
        ref={rowRef}
        className={`group flex items-center gap-1 py-1 px-1 rounded-md ${
          dragOver === "top" ? "border-t-2 border-indigo-400" :
          dragOver === "bottom" ? "border-b-2 border-indigo-400" :
          dragOver === "center" ? "bg-indigo-50 dark:bg-indigo-500/10" :
          isSelected ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""
        } ${isAnyMenuOpen ? "relative z-30" : ""}`}
        onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : node.id); }}
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
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          {hasChildren ? (
            node.collapsed ? (
              <ChevronRight size={14} strokeWidth={2} />
            ) : (
              <ChevronDown size={14} strokeWidth={2} />
            )
          ) : null}
        </button>

        {/* Drag handle */}
        <span
          draggable
          onDragStart={handleDragStart}
          className="cursor-grab text-gray-300 hover:text-gray-500 flex-shrink-0 select-none flex items-center"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </span>

        {/* Status icon */}
        {!isAncestorOnly && STATUS_ICON[node.status].icon && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (node.status === "completed" || node.status === "cancelled") {
                onMarkUndone(node.id);
              } else {
                onMarkDone(node.id);
              }
            }}
            className={`flex-shrink-0 flex items-center justify-center w-4 h-4 ${STATUS_ICON[node.status].color}`}
          >
            {(() => {
              const Icon = STATUS_ICON[node.status].icon;
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
            className="flex-1 text-sm px-2 py-0.5 border border-gray-300 rounded outline-none focus:border-indigo-500 min-w-0"
            placeholder="Type an idea..."
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            className={`flex-1 text-sm px-2 py-0.5 rounded min-w-0 truncate ${
              isAncestorOnly ? "text-gray-400 italic cursor-default" :
              node.status === "completed" ? "text-violet-600/70 dark:text-violet-400/60 cursor-text hover:bg-gray-100 dark:hover:bg-white/[0.04]" :
              node.status === "cancelled" ? "text-red-400/60 dark:text-red-400/50 cursor-text hover:bg-gray-100 dark:hover:bg-white/[0.04]" :
              node.status === "paused" ? "text-orange-600/70 dark:text-orange-400/60 cursor-text hover:bg-gray-100 dark:hover:bg-white/[0.04]" :
              node.status === "in_progress" ? "text-amber-700 dark:text-amber-300 cursor-text hover:bg-gray-100 dark:hover:bg-white/[0.04]" :
              "text-gray-800 dark:text-gray-200 cursor-text hover:bg-gray-100 dark:hover:bg-white/[0.04]"
            }`}
          >
            {node.text || <span className="text-gray-400 italic">empty</span>}
          </span>
        )}

        {/* Type pill */}
        {showType && (
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTypePicker(!showTypePicker)}
              className={`text-xs px-2 py-0.5 rounded-full border ${
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
          <div className="relative flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {nodeTags.map((tag) => (
              <span
                key={tag.id}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${
                  AREA_DOT_COLORS[tag.area]
                    ? "border-current/20"
                    : "border-gray-200 text-gray-400"
                }`}
                style={{ opacity: 0.85 }}
              >
                <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${AREA_DOT_COLORS[tag.area]}`} />
                {tag.name}
              </span>
            ))}
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              title="Add tag"
            >
              {nodeTags.length === 0 ? "tag" : "+"}
            </button>
            {showTagPicker && (
              <TagPicker
                allTags={allTags}
                selectedTags={nodeTags}
                onAdd={(tag) => { void onAddTag(node.id, tag); }}
                onRemove={(tagId) => { void onRemoveTag(node.id, tagId); }}
                onCreateTag={onCreateTag}
                onClose={() => setShowTagPicker(false)}
              />
            )}
          </div>
        )}

        {/* Status pill */}
        {!isAncestorOnly && (
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer ${
                STATUS_STYLES[node.status]
              }`}
            >
              {STATUS_LABELS[node.status]}
            </button>
            {showStatusPicker && (
              <div className="absolute right-0 top-full mt-1 z-50">
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
          <span className="text-xs text-indigo-500 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {linkCount}
          </span>
        )}

        {/* Scheduled date chip */}
        {node.scheduled_date && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 border ${
            node.scheduled_date === todayString
              ? "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/30"
              : "text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
          }`}>
            {formatScheduleDate(node.scheduled_date, todayString)}
          </span>
        )}

        {/* Actions (visible on hover) */}
        <div
          className="relative flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowStatusPicker(false);
              setShowDeleteWarning(false);
              setShowMovePanel(false);
              setShowSchedulePicker(false);
              setShowLinkPanel(!showLinkPanel);
            }}
            title="Link"
            className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded"
          >
            <Link2 size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              setShowStatusPicker(false);
              setShowDeleteWarning(false);
              setShowLinkPanel(false);
              setShowSchedulePicker(false);
              setShowMovePanel(!showMovePanel);
            }}
            title="Move"
            className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded"
          >
            <ArrowUpDown size={14} strokeWidth={1.5} />
          </button>
          <div className="relative">
            <button
              onClick={() => {
                setShowStatusPicker(false);
                setShowDeleteWarning(false);
                setShowMovePanel(false);
                setShowLinkPanel(false);
                setShowSchedulePicker(!showSchedulePicker);
              }}
              title="Schedule"
              className={`w-6 h-6 flex items-center justify-center rounded ${
                node.scheduled_date
                  ? "text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/20"
                  : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              }`}
            >
              <Calendar size={14} strokeWidth={1.5} />
            </button>
            {showSchedulePicker && (
              <SchedulePicker
                currentDate={node.scheduled_date}
                onSelect={(date) => { onSchedule(node.id, date); setShowSchedulePicker(false); }}
                onClear={() => { onSchedule(node.id, null); setShowSchedulePicker(false); }}
                onClose={() => setShowSchedulePicker(false)}
              />
            )}
          </div>
          <div className="relative">
            <button
              onClick={handleRequestDelete}
              title="Delete"
              aria-expanded={showDeleteWarning}
              className={`w-6 h-6 flex items-center justify-center rounded ${
                showDeleteWarning
                  ? "text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/20"
                  : "text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              }`}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
            {showDeleteWarning && (
              <div className="absolute right-0 top-7 z-20 w-52 rounded-xl border border-red-200 dark:border-red-500/30 glass-card-strong p-2">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Delete this idea?</p>
                {hasChildren && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Child ideas will be deleted too.</p>
                )}
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    onClick={() => setShowDeleteWarning(false)}
                    className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-400 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
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
        </div>
      </div>

      {isSelected && !search && !node.collapsed && (
        <IdeaComposer
          depth={depth + 1}
          placeholder="Add child idea..."
          onCreate={handleCreateChild}
          onDismiss={() => setSelectedId(null)}
        />
      )}

      {/* Children */}
      {hasChildren && !node.collapsed && (
        <div>
          {node.children.filter((child) => matchesSearch(child)).map((child) => (
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
