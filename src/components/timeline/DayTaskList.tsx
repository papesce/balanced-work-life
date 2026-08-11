"use client";

import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Reorder, useDragControls } from "framer-motion";
import { Star, MoreHorizontal, GripVertical } from "lucide-react";
import { Idea, IdeaStatus, Tag, LifeArea } from "@/lib/types";
import { TagPicker } from "@/components/shared/TagPicker";
import { AREA_DOT_COLORS, STATUS_CONFIG } from "@/lib/constants";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { RescheduleAction, DayOccurrence } from "@/lib/tasks/rescheduleTask";

interface DayTaskListProps {
  occurrences: DayOccurrence[];
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  today: string;
  onGoToDate?: (date: string, taskId: string) => void;
  allTags: Tag[];
  getTagsForIdea: (ideaId: string) => Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}

export function DayTaskList({ occurrences, onReorder, onDone, onUndone, onUpdate, onReschedule, today, onGoToDate, allTags, getTagsForIdea, onAddTag, onRemoveTag, onCreateTag }: DayTaskListProps) {
  const currentTasks = useMemo(() => occurrences.filter((o) => !o.isHistorical).map((o) => o.task), [occurrences]);
  const historical = useMemo(() => occurrences.filter((o) => o.isHistorical), [occurrences]);
  const [items, setItems] = useState(currentTasks);
  const [prevTasks, setPrevTasks] = useState(currentTasks);
  const itemsRef = useRef(items);

  if (prevTasks !== currentTasks) {
    setPrevTasks(currentTasks);
    setItems(currentTasks);
  }
  useEffect(() => { itemsRef.current = items; }, [items]);

  return (
    <>
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-0.5" style={{ overflow: "visible" }}>
        {items.map((task) => (
          <DayTaskItem
            key={task.id}
            task={task}
            occurrenceDate={task.scheduled_date ?? undefined}
            onReorder={() => onReorder(itemsRef.current)}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onReschedule={onReschedule}
            today={today}
            allTags={allTags}
            taskTags={getTagsForIdea(task.id)}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onCreateTag={onCreateTag}
          />
        ))}
      </Reorder.Group>

      {historical.length > 0 && (
        <div className="mt-2 rounded-xl border border-amber-200/40 dark:border-amber-800/30 bg-amber-50/40 dark:bg-amber-950/10 overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Deferred from this date
          </div>
          {historical.map((occ) => (
            <HistoricalOccurrenceRow
              key={occ.task.id}
              task={occ.task}
              occurrenceDate={occ.date}
              taskTags={getTagsForIdea(occ.task.id)}
              onDone={onDone}
              onUndone={onUndone}
              onUpdate={onUpdate}
              onReschedule={onReschedule}
              today={today}
              onGoToDate={onGoToDate}
              allTags={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onCreateTag={onCreateTag}
              isHistorical
            />
          ))}
        </div>
      )}
    </>
  );
}

function HistoricalOccurrenceRow({
  task,
  occurrenceDate,
  taskTags,
  onDone,
  onUndone,
  onUpdate,
  onReschedule,
  today,
  onGoToDate,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  isHistorical = false,
}: {
  task: Idea;
  occurrenceDate: string;
  taskTags: Tag[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  today: string;
  onGoToDate?: (date: string, taskId: string) => void;
  allTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  isHistorical?: boolean;
}) {
  return (
    <div className="px-1">
      <TimelineTaskRow
        task={task}
        occurrenceDate={occurrenceDate}
        onDone={onDone}
        onUndone={onUndone}
        onUpdate={onUpdate}
        onReschedule={onReschedule}
        today={today}
        dragControls={useDragControls()}
        allTags={allTags}
        taskTags={taskTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
        isHistorical={isHistorical}
        onGoToDate={onGoToDate}
      />
    </div>
  );
}

function DayTaskItem({
  task, occurrenceDate, onReorder, onDone, onUndone, onUpdate, onReschedule, today, allTags, taskTags, onAddTag, onRemoveTag, onCreateTag,
}: {
  task: Idea;
  occurrenceDate?: string;
  onReorder: () => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  today: string;
  allTags: Tag[];
  taskTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={task} dragControls={controls} className="relative" onDragEnd={onReorder}>
      <TimelineTaskRow task={task} occurrenceDate={occurrenceDate} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onReschedule={onReschedule} today={today} dragControls={controls} allTags={allTags} taskTags={taskTags} onAddTag={onAddTag} onRemoveTag={onRemoveTag} onCreateTag={onCreateTag} />
    </Reorder.Item>
  );
}

function TimelineTaskRow({
  task, occurrenceDate, onDone, onUndone, onUpdate, onReschedule, today, dragControls, allTags, taskTags, onAddTag, onRemoveTag, onCreateTag, isHistorical = false, onGoToDate,
}: {
  task: Idea;
  occurrenceDate?: string;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  today: string;
  dragControls: ReturnType<typeof useDragControls>;
  allTags: Tag[];
  taskTags: Tag[];
  onAddTag: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag: (ideaId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, area: LifeArea) => Promise<Tag | null>;
  isHistorical?: boolean;
  onGoToDate?: (date: string, taskId: string) => void;
}) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isInProgress = task.status === "in_progress";
  const isPaused = task.status === "paused";
  const isReschedule = isHistorical || task.status === "deferred" || (task.scheduled_date !== null && task.scheduled_date < today);
  const dateActionLabel = isReschedule ? "Reschedule" : "Move";
  const statusConfig = STATUS_CONFIG[task.status];
  const attemptTarget = task.scheduled_date ?? task.attempt_dates[task.attempt_dates.length - 1];
  const attemptLabel = task.scheduled_date ? "Go to next attempt" : "Go to last attempt";
  const [showMenu, setShowMenu] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const [tagPickerPos, setTagPickerPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          menuTriggerRef.current && !menuTriggerRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showMenu]);

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!showStatusPicker) return;
    const close = () => setShowStatusPicker(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showStatusPicker]);

  const handleStatusSelect = (status: IdeaStatus) => {
    const now = new Date().toISOString();
    switch (status) {
      case "completed":
        onDone(task.id);
        break;
      case "cancelled":
        onUpdate(task.id, { status: "cancelled", cancelled_at: now });
        break;
      case "in_progress":
        onUpdate(task.id, { status: "in_progress" });
        break;
      case "paused":
        onUpdate(task.id, { status: "paused", paused_at: now });
        break;
      case "planned":
        onUpdate(task.id, { status: "planned" });
        break;
      case "scheduled":
        onUndone(task.id);
        break;
      case "deferred":
        onUpdate(task.id, {
          status: "deferred",
          completed_at: null,
          cancelled_at: null,
        });
        break;
    }
    setShowStatusPicker(false);
  };

  const handleStartEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    if (editText.trim() && editText.trim() !== task.text) {
      onUpdate(task.id, { text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div
      id={occurrenceDate ? `task-${task.id}-${occurrenceDate}` : undefined}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-colors group ${isHovered ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>

      {statusConfig.icon && (
        <statusConfig.icon size={12} strokeWidth={2} className={`flex-shrink-0 ${statusConfig.textClass}`} />
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirmEdit}
          className="flex-1 text-sm px-1.5 py-0.5 border border-violet-300 dark:border-violet-600 rounded-lg outline-none focus:border-violet-500 min-w-0 bg-white/80 dark:bg-gray-800/80"
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-1 text-sm truncate cursor-text hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded px-1 -mx-1 ${isCancelled ? "text-red-400/60" : ""}`}
          style={{
            fontWeight: 450,
            color: isCompleted ? "rgba(107, 114, 128, 0.6)" : isCancelled ? "rgba(239, 68, 68, 0.5)" : isPaused ? "rgba(249, 115, 22, 0.7)" : "var(--text-primary)",
          }}
        >
          {task.text}
        </span>
      )}

      {task.scheduled_time && (
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex-shrink-0 tabular-nums">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}

      <div className="relative flex items-center gap-1 flex-shrink-0">
        {taskTags.map((tag) => (
          <span
            key={tag.id}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1"
            style={{ opacity: 0.85 }}
          >
            <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${AREA_DOT_COLORS[tag.area]}`} />
            {tag.name}
          </span>
        ))}
        <button
          ref={tagTriggerRef}
          onClick={() => {
            if (showTagPicker) { setShowTagPicker(false); return; }
            const rect = tagTriggerRef.current?.getBoundingClientRect();
            if (rect) setTagPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowTagPicker(true);
          }}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:bg-black/10 dark:hover:bg-white/10"
        >
          {taskTags.length === 0 ? "tag" : "+"}
        </button>
        {showTagPicker && tagPickerPos && (
          <TagPicker
            allTags={allTags}
            selectedTags={taskTags}
            onAdd={(tag) => { void onAddTag(task.id, tag); }}
            onRemove={(tagId) => { void onRemoveTag(task.id, tagId); }}
            onCreateTag={onCreateTag}
            onClose={() => setShowTagPicker(false)}
            fixedPosition={tagPickerPos}
          />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          ref={statusTriggerRef}
          onClick={() => {
            if (showStatusPicker) { setShowStatusPicker(false); return; }
            const rect = statusTriggerRef.current?.getBoundingClientRect();
            if (rect) setStatusPickerPos({ top: rect.bottom + 4, left: rect.left });
            setShowStatusPicker(true);
          }}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer hover:opacity-80"
          style={{
            background: isCompleted ? "#f5f3ff" : isCancelled ? "#fef2f2" : isPaused ? "#fff7ed" : isInProgress ? "#fefce8" : "rgba(0,0,0,0.05)",
            color: isCompleted ? "#7c3aed" : isCancelled ? "#ef4444" : isPaused ? "#f97316" : isInProgress ? "#d97706" : "#9ca3af",
          }}
        >
          {statusConfig.label}
        </button>
        {showStatusPicker && statusPickerPos && createPortal(
          <div style={{ position: "fixed", top: statusPickerPos.top, left: statusPickerPos.left, zIndex: 9999 }}>
            <StatusPicker
              current={task.status}
              onSelect={handleStatusSelect}
              onClose={() => setShowStatusPicker(false)}
            />
          </div>,
          document.body
        )}
      </div>

      <button
        onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
        className={`transition-colors flex-shrink-0 ${task.is_priority ? "text-amber-400" : "text-gray-200 dark:text-gray-600 hover:text-gray-400"}`}
      >
        <Star size={14} strokeWidth={1.5} className={task.is_priority ? "fill-amber-400" : ""} />
      </button>

      <div className="relative">
        <button
          ref={menuTriggerRef}
          onClick={() => {
            if (showMenu) { setShowMenu(false); return; }
            const rect = menuTriggerRef.current?.getBoundingClientRect();
            if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
            setShowMenu(true);
          }}
          className={`text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-all flex-shrink-0 ${isHovered || showMenu ? "opacity-100" : "opacity-0"}`}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
        {showMenu && menuPos && createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="glass-card-strong rounded-xl py-1.5 min-w-[160px] shadow-lg"
          >
            {isHistorical && onGoToDate && attemptTarget && (
              <>
                <button
                  onClick={() => { onGoToDate(attemptTarget, task.id); setShowMenu(false); }}
                  className="flex w-full text-left px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                >
                  {attemptLabel}
                </button>
                <div className="border-t border-black/5 dark:border-white/5 my-1" />
              </>
            )}
            {task.scheduled_date !== today && (
              <button
                onClick={() => { void onReschedule(task.id, isReschedule ? { type: "retry_today" } : { type: "move", newDate: today }); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                {dateActionLabel} to Today
              </button>
            )}
            <div className="relative group/date">
              <button className="flex w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                {dateActionLabel} Date…
              </button>
              <input
                type="date"
                className="absolute left-full top-0 ml-1 opacity-0 w-0 h-0 pointer-events-none group-hover/date:opacity-100 group-hover/date:w-auto group-hover/date:h-auto group-hover/date:pointer-events-auto text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                onChange={(e) => {
                  if (e.target.value) { void onReschedule(task.id, isReschedule ? { type: "reschedule", newDate: e.target.value } : { type: "move", newDate: e.target.value }); setShowMenu(false); }
                }}
              />
            </div>

            <div className="border-t border-black/5 dark:border-white/5 my-1" />
            <button
              onClick={() => { onUpdate(task.id, { status: "archived" }); setShowMenu(false); }}
              className="flex w-full text-left px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
            >
              Archive
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
