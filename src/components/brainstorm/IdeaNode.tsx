"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { IdeaNode as IdeaNodeType, Idea, IdeaLink, IdeaType, LifeArea, LinkType, Task, TimeBucket } from "@/lib/types";
import { TypePicker } from "./TypePicker";
import { AreaPicker } from "./AreaPicker";
import { LinkPanel } from "./LinkPanel";
import { PromoteMenu } from "./PromoteMenu";
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
  activeTasksByIdeaId: Map<string, Task>;
  onPromote: (ideaId: string, bucket: TimeBucket) => void;
  onMarkDone: (id: string) => Promise<void>;
  onMarkUndone: (id: string) => Promise<void>;
  onSchedule: (id: string, date: string | null) => Promise<void>;
  todayString: string;
  isAncestorOnly?: boolean;
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
  idea: "bg-orange-50 text-orange-700 border-orange-200",
  objective: "bg-purple-50 text-purple-700 border-purple-200",
  project: "bg-emerald-50 text-emerald-700 border-emerald-200",
  initiative: "bg-amber-50 text-amber-700 border-amber-200",
  task: "bg-blue-50 text-blue-700 border-blue-200",
};

const AREA_COLORS: Record<LifeArea, string> = {
  work: "bg-blue-50 text-blue-700 border-blue-200",
  health: "bg-red-50 text-red-700 border-red-200",
  relationships: "bg-pink-50 text-pink-700 border-pink-200",
  growth: "bg-amber-50 text-amber-700 border-amber-200",
  finances: "bg-emerald-50 text-emerald-700 border-emerald-200",
  life: "bg-green-50 text-green-700 border-green-200",
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
  activeTasksByIdeaId,
  onPromote,
  onMarkDone,
  onMarkUndone,
  onSchedule,
  todayString,
  isAncestorOnly,
}: IdeaNodeProps) {
  const isEditing = editingId === node.id;
  const isSelected = selectedId === node.id;
  const [editText, setEditText] = useState(node.text);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [dragOver, setDragOver] = useState<"top" | "center" | "bottom" | null>(null);
  const [showPromoteMenu, setShowPromoteMenu] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const activeTask = activeTasksByIdeaId.get(node.id);

  const BUCKET_CHIP_LABELS: Record<TimeBucket, string> = {
    today: "Hoy",
    tomorrow: "Mañana",
    next_week: "Semana",
    backlog: "Backlog",
  };

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

  const matchesSearch = (n: IdeaNodeType): boolean => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (n.text.toLowerCase().includes(q)) return true;
    return n.children.some(matchesSearch);
  };

  return (
    <div style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      <div
        ref={rowRef}
        className={`group flex items-center gap-1 py-1 px-1 rounded-md ${
          dragOver === "top" ? "border-t-2 border-indigo-400" :
          dragOver === "bottom" ? "border-b-2 border-indigo-400" :
          dragOver === "center" ? "bg-indigo-50" :
          isSelected ? "bg-indigo-50/60" : ""
        }`}
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
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs"
        >
          {hasChildren ? (node.collapsed ? "▶" : "▼") : ""}
        </button>

        {/* Drag handle */}
        <span
          draggable
          onDragStart={handleDragStart}
          className="cursor-grab text-gray-300 hover:text-gray-500 flex-shrink-0 text-sm select-none"
        >
          ⠿
        </span>

        {/* Done checkbox */}
        {node.scheduled_date && !isAncestorOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (node.done_at) {
                onMarkUndone(node.id);
              } else {
                onMarkDone(node.id);
              }
            }}
            className={`w-4 h-4 border-2 rounded-full flex-shrink-0 ${
              node.done_at
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-indigo-500"
            }`}
          />
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
              node.done_at ? "line-through text-gray-400 cursor-text hover:bg-gray-100" :
              "text-gray-800 cursor-text hover:bg-gray-100"
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

        {/* Area pill */}
        {showArea && (
          <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowAreaPicker(!showAreaPicker)}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                node.area ? AREA_COLORS[node.area] : "border-gray-200 text-gray-400"
              }`}
            >
              {node.area ? node.area.charAt(0).toUpperCase() + node.area.slice(1) : "—"}
            </button>
            {showAreaPicker && (
              <AreaPicker
                current={node.area}
                onSelect={(area) => {
                  updateIdea(node.id, { area });
                  setShowAreaPicker(false);
                }}
                onClose={() => setShowAreaPicker(false)}
              />
            )}
          </div>
        )}

        {/* Link count badge */}
        {linkCount > 0 && (
          <span className="text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {linkCount}
          </span>
        )}

        {/* Active task status chip */}
        {activeTask && (
          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-blue-200">
            {BUCKET_CHIP_LABELS[activeTask.time_bucket]}
          </span>
        )}

        {/* Scheduled date chip */}
        {node.scheduled_date && !activeTask && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 border ${
            node.scheduled_date === todayString
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-gray-600 bg-gray-50 border-gray-200"
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
              setShowMovePanel(false);
              setShowSchedulePicker(false);
              setShowLinkPanel(!showLinkPanel);
            }}
            title="Link"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded text-xs"
          >
            🔗
          </button>
          <button
            onClick={() => {
              setShowLinkPanel(false);
              setShowPromoteMenu(false);
              setShowSchedulePicker(false);
              setShowMovePanel(!showMovePanel);
            }}
            title="Move"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded text-xs"
          >
            ↕
          </button>
          <div className="relative">
            <button
              onClick={() => {
                setShowMovePanel(false);
                setShowLinkPanel(false);
                setShowPromoteMenu(false);
                setShowSchedulePicker(!showSchedulePicker);
              }}
              title="Schedule"
              className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                node.scheduled_date
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              📅
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
          {node.type === "task" && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowMovePanel(false);
                  setShowSchedulePicker(false);
                  setShowPromoteMenu(!showPromoteMenu);
                }}
                title="Promote to task"
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded text-xs"
              >
                ▶
              </button>
              {showPromoteMenu && (
                <PromoteMenu
                  hasActiveTask={!!activeTask}
                  onSelect={(bucket) => {
                    onPromote(node.id, bucket);
                    setShowPromoteMenu(false);
                  }}
                  onViewInPlanner={activeTask ? () => {
                    window.location.href = `/planner?highlight=${activeTask.id}`;
                  } : undefined}
                  onClose={() => setShowPromoteMenu(false)}
                />
              )}
            </div>
          )}
          <button
            onClick={() => deleteIdea(node.id)}
            title="Delete"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded text-xs"
          >
            ×
          </button>
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
              activeTasksByIdeaId={activeTasksByIdeaId}
              onPromote={onPromote}
              onMarkDone={onMarkDone}
              onMarkUndone={onMarkUndone}
              onSchedule={onSchedule}
              todayString={todayString}
              isAncestorOnly={isAncestorOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
