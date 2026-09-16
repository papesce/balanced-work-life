"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Reorder, useDragControls } from "framer-motion";
import { Star, MoreHorizontal, GripVertical, Clock } from "lucide-react";
import { UndoAction } from "@/lib/tasks/undo";
import { areaColors } from "@/styles/tokens";
import { Idea, IdeaStatus, LifeArea, Tag } from "@/lib/types";
import { STATUS_CONFIG, PRODUCTIVITY_SIGNALS } from "@/lib/constants";
import { TagPicker } from "@/components/shared/TagPicker";
import { formatTime } from "./plannerUtils";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";
import { RescheduleAction } from "@/lib/tasks/rescheduleTask";
import { getToday } from "@/lib/dateUtils";
import { RevealInMenu } from "@/components/shared/RevealInMenu";
import { NotesIndicator } from "@/components/shared/NotesIndicator";
import { useNotes } from "@/contexts/NotesContext";
import { Eye } from "lucide-react";
import { applyStatusTransition } from "@/lib/tasks/statusTransition";

interface PendingTaskListProps {
  tasks: Idea[];
  area: LifeArea;
  onReorder: (taskIds: string[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMoveTaskBetweenAreas?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  getTagsForIdea?: (ideaId: string) => Tag[];
  allTags?: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onUndoAction?: (action: UndoAction) => void;
}

export function PendingTaskList({
  tasks,
  area,
  onReorder,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onReschedule,
  onMoveTaskBetweenAreas,
  getTagsForIdea,
  allTags,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  onUndoAction,
}: PendingTaskListProps) {
  const [items, setItems] = useState(tasks);
  const itemsRef = useRef(items);
  const isNativeDraggingRef = useRef(false);
  const isFramerDraggingRef = useRef(false);
  const queuedTasksRef = useRef<Idea[] | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (tasks !== itemsRef.current) {
      if (isNativeDraggingRef.current) {
        queuedTasksRef.current = tasks;
      } else {
        setItems(tasks);
      }
    }
  }, [tasks]);

  const handleNativeDragStart = useCallback(() => {
    isNativeDraggingRef.current = true;
  }, []);
  const handleFramerDragStart = useCallback(() => {
    isFramerDraggingRef.current = true;
  }, []);
  const handleFramerDragEnd = useCallback(() => {
    isFramerDraggingRef.current = false;
  }, []);
  const abortFramerDrag = useCallback(() => {
    if (!isFramerDraggingRef.current) return;
    try {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
    } catch {}
    isFramerDraggingRef.current = false;
  }, []);
  const handleNativeDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_source: string) => {
      isNativeDraggingRef.current = false;
      if (queuedTasksRef.current) {
        setItems(queuedTasksRef.current);
        queuedTasksRef.current = null;
      } else if (tasks !== itemsRef.current) {
        setItems(tasks);
      }
    },
    [tasks],
  );

  useEffect(() => {
    const onWindowDragEnd = () => {
      handleNativeDragEnd("window:dragend");
    };
    const onWindowDrop = () => {
      abortFramerDrag();
      handleNativeDragEnd("window:drop");
    };
    window.addEventListener("dragend", onWindowDragEnd);
    window.addEventListener("drop", onWindowDrop);
    return () => {
      window.removeEventListener("dragend", onWindowDragEnd);
      window.removeEventListener("drop", onWindowDrop);
    };
  }, [handleNativeDragEnd, abortFramerDrag]);

  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} style={{ overflow: "visible" }}>
      {items.map((task) => (
        <ReorderItemWrapper
          key={task.id}
          task={task}
          area={area}
          onReorder={onReorder}
          itemsRef={itemsRef}
          onDone={onDone}
          onUndone={onUndone}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onReschedule={onReschedule}
          onMoveTaskBetweenAreas={onMoveTaskBetweenAreas}
          getTagsForIdea={getTagsForIdea}
          allTags={allTags}
          onCreateTag={onCreateTag}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onNativeDragStart={handleNativeDragStart}
          onNativeDragEnd={handleNativeDragEnd}
          onFramerDragStart={handleFramerDragStart}
          onFramerDragEnd={handleFramerDragEnd}
          onUndoAction={onUndoAction}
        />
      ))}
    </Reorder.Group>
  );
}

function ReorderItemWrapper({
  task,
  area,
  onReorder,
  itemsRef,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onReschedule,
  onMoveTaskBetweenAreas,
  getTagsForIdea,
  allTags,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  onNativeDragStart,
  onNativeDragEnd,
  onFramerDragStart,
  onFramerDragEnd,
  onUndoAction,
}: {
  task: Idea;
  area: LifeArea;
  onReorder: (taskIds: string[]) => void;
  itemsRef: React.MutableRefObject<Idea[]>;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMoveTaskBetweenAreas?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  getTagsForIdea?: (ideaId: string) => Tag[];
  allTags?: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  onNativeDragStart?: () => void;
  onNativeDragEnd?: (source: string) => void;
  onFramerDragStart?: () => void;
  onFramerDragEnd?: () => void;
  onUndoAction?: (action: UndoAction) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={dragControls}
      className="relative"
      onDragStart={() => {
        onFramerDragStart?.();
      }}
      onDragEnd={() => {
        onFramerDragEnd?.();
        onReorder(itemsRef.current.map((t) => t.id));
      }}
    >
      <TaskRow
        task={task}
        area={area}
        onDone={onDone}
        onUndone={onUndone}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onReschedule={onReschedule}
        onMoveTaskBetweenAreas={onMoveTaskBetweenAreas}
        getTagsForIdea={getTagsForIdea}
        allTags={allTags}
        onCreateTag={onCreateTag}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        showDragHandle
        dragControls={dragControls}
        onNativeDragStart={onNativeDragStart}
        onNativeDragEnd={onNativeDragEnd}
        onUndoAction={onUndoAction}
      />
    </Reorder.Item>
  );
}

function TaskRow({
  task,
  area,
  onDone,
  onUndone,
  onUpdate,
  onDelete,
  onReschedule,
  onMoveTaskBetweenAreas,
  getTagsForIdea,
  allTags,
  onCreateTag,
  onAddTag,
  onRemoveTag,
  showDragHandle,
  dragControls,
  onNativeDragStart,
  onNativeDragEnd,
  onUndoAction,
}: {
  task: Idea;
  area: LifeArea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string, action: RescheduleAction) => Promise<void>;
  onMoveTaskBetweenAreas?: (taskId: string, fromArea: LifeArea, toArea: LifeArea) => void;
  getTagsForIdea?: (ideaId: string) => Tag[];
  allTags?: Tag[];
  onCreateTag?: (name: string, area: LifeArea) => Promise<Tag | null>;
  onAddTag?: (ideaId: string, tag: Tag) => Promise<void>;
  onRemoveTag?: (ideaId: string, tagId: string) => Promise<void>;
  showDragHandle?: boolean;
  dragControls?: ReturnType<typeof useDragControls>;
  onNativeDragStart?: () => void;
  onNativeDragEnd?: (source: string) => void;
  onUndoAction?: (action: UndoAction) => void;
}) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isPaused = task.status === "paused";
  const isInProgress = task.status === "in_progress";
  const statusConfig = STATUS_CONFIG[task.status];
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusPickerRef = useRef<HTMLDivElement>(null);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState(task.duration_minutes?.toString() ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const durationRef = useRef<HTMLDivElement>(null);
  const areaDotRef = useRef<HTMLButtonElement>(null);
  const areaPickerRef = useRef<HTMLDivElement>(null);
  const [areaPickerPos, setAreaPickerPos] = useState<{ top: number; left: number } | null>(null);
  const timeRef = useRef<HTMLButtonElement>(null);
  const timeMenuRef = useRef<HTMLDivElement>(null);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [timeMenuPos, setTimeMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const [showDateInput, setShowDateInput] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isReschedule =
    task.status === "deferred" ||
    (task.scheduled_date !== null && task.scheduled_date < getToday());
  const dateActionLabel = isReschedule ? "Reschedule" : "Move";
  const [revealPos, setRevealPos] = useState<{ top: number; right: number } | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const { openNotes } = useNotes();

  useEffect(() => {
    if (!showDateInput || !dateInputRef.current) return;
    const input = dateInputRef.current;
    input.focus();
    if (typeof input.showPicker === "function") {
      const picker = input.showPicker() as unknown as Promise<void> | undefined;
      picker?.catch?.(() => {});
    }
  }, [showDateInput]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
      if (
        statusPickerRef.current &&
        !statusPickerRef.current.contains(e.target as Node) &&
        statusTriggerRef.current &&
        !statusTriggerRef.current.contains(e.target as Node)
      ) {
        setShowStatusPicker(false);
      }
      if (durationRef.current && !durationRef.current.contains(e.target as Node))
        setShowDurationDropdown(false);
      if (
        areaPickerRef.current &&
        !areaPickerRef.current.contains(e.target as Node) &&
        areaDotRef.current &&
        !areaDotRef.current.contains(e.target as Node)
      ) {
        setShowAreaPicker(false);
      }
      if (
        timeMenuRef.current &&
        !timeMenuRef.current.contains(e.target as Node) &&
        timeRef.current &&
        !timeRef.current.contains(e.target as Node)
      ) {
        setShowTimeMenu(false);
      }
    };
    if (showMenu || showStatusPicker || showDurationDropdown || showAreaPicker || showTimeMenu)
      document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showMenu, showStatusPicker, showDurationDropdown, showAreaPicker, showTimeMenu]);

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

  useEffect(() => {
    if (!showAreaPicker) return;
    const close = () => setShowAreaPicker(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showAreaPicker]);

  useEffect(() => {
    if (!showTimeMenu) return;
    const close = () => setShowTimeMenu(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [showTimeMenu]);

  const handleStatusSelect = (status: IdeaStatus) => {
    applyStatusTransition(task.id, status, onUpdate, { onDone, onUndone });
    setShowStatusPicker(false);
  };

  const handleTagSelected = async (tag: Tag) => {
    if (onAddTag) {
      await onAddTag(task.id, tag);
    }
    setShowAreaPicker(false);
  };

  const taskTags = getTagsForIdea?.(task.id) ?? [];
  const signalCfg =
    task.productivity_signal &&
    PRODUCTIVITY_SIGNALS[task.productivity_signal as keyof typeof PRODUCTIVITY_SIGNALS];

  return (
    <div
      id={`task-${task.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.setData("text/lifearea", area);
        e.dataTransfer.effectAllowed = "move";
        onNativeDragStart?.();
      }}
      onDragEnd={() => {
        onNativeDragEnd?.("row:dragend");
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setRevealPos({ top: e.clientY + 4, right: window.innerWidth - e.clientX - 4 });
        setShowReveal(true);
      }}
      className={`group flex cursor-grab items-center gap-2 px-4 py-2.5 transition-colors hover:bg-black/[0.015] active:cursor-grabbing dark:hover:bg-white/[0.015] ${
        signalCfg ? "border-b-2" : ""
      }`}
      style={
        signalCfg
          ? {
              background: signalCfg.bg,
              borderLeft: `3px solid ${signalCfg.color}`,
              borderBottomColor: signalCfg.color,
            }
          : undefined
      }
      aria-label={signalCfg ? `Productivity: ${signalCfg.label}` : undefined}
    >
      {showDragHandle && (
        <div
          onPointerDown={(e) => {
            dragControls?.start(e);
          }}
          onDragStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          draggable={false}
          className="flex-shrink-0 cursor-grab text-gray-300 transition-colors hover:text-gray-400 active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 dark:text-gray-600"
        >
          <GripVertical size={11} />
        </div>
      )}

      {statusConfig.icon && (
        <statusConfig.icon
          size={12}
          strokeWidth={2}
          className={`flex-shrink-0 ${statusConfig.textClass}`}
        />
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirmEdit}
          className="min-w-0 flex-1 rounded-lg border border-violet-300 bg-white/80 px-1.5 py-0.5 text-[13px] font-semibold outline-none focus:border-violet-500 dark:border-violet-600 dark:bg-gray-800/80"
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`-mx-1 min-w-0 flex-1 cursor-text truncate rounded px-1 text-[13px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
            isCompleted
              ? "font-normal text-gray-400 dark:text-gray-500"
              : isCancelled
                ? "font-normal text-red-400/60"
                : isPaused
                  ? "font-semibold text-orange-600/70 dark:text-orange-400/70"
                  : "font-semibold text-gray-700 dark:text-gray-200"
          }`}
        >
          {task.text}
        </span>
      )}

      <div className="flex-shrink-0">
        <button
          ref={statusTriggerRef}
          onClick={() => {
            if (showStatusPicker) {
              setShowStatusPicker(false);
              return;
            }
            const rect = statusTriggerRef.current?.getBoundingClientRect();
            if (rect) setStatusPickerPos({ top: rect.bottom + 6, left: rect.left });
            setShowStatusPicker(true);
          }}
          className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all hover:opacity-80"
          style={{
            background: isCompleted
              ? "#f5f3ff"
              : isCancelled
                ? "#fef2f2"
                : isPaused
                  ? "#fff7ed"
                  : isInProgress
                    ? "#fefce8"
                    : "rgba(0,0,0,0.05)",
            color: isCompleted
              ? "#7c3aed"
              : isCancelled
                ? "#ef4444"
                : isPaused
                  ? "#f97316"
                  : isInProgress
                    ? "#d97706"
                    : "#9ca3af",
          }}
        >
          {statusConfig.label}
        </button>
        {showStatusPicker &&
          statusPickerPos &&
          createPortal(
            <div
              ref={statusPickerRef}
              style={{
                position: "fixed",
                top: statusPickerPos.top,
                left: statusPickerPos.left,
                zIndex: 9999,
              }}
            >
              <StatusPicker
                current={task.status}
                onSelect={handleStatusSelect}
                onClose={() => setShowStatusPicker(false)}
              />
            </div>,
            document.body,
          )}
      </div>

      <div className="relative" ref={durationRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDurationDropdown(!showDurationDropdown);
            setShowCustomInput(false);
          }}
          className={`flex flex-shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
            task.duration_minutes
              ? "bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
              : "text-gray-400 hover:bg-black/5 md:opacity-0 md:group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-white/5"
          }`}
          title="Set task duration"
        >
          <Clock size={11} />
          {task.duration_minutes ? `${task.duration_minutes}m` : ""}
        </button>

        {showDurationDropdown && (
          <div className="glass-card-strong absolute top-full right-0 z-50 mt-1.5 min-w-[110px] space-y-1 rounded-xl border border-black/5 p-1.5 shadow-xl dark:border-white/5">
            {!showCustomInput ? (
              <>
                {[15, 30, 45, 60, 90, 120].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: preset });
                      setShowDurationDropdown(false);
                    }}
                    className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-gray-400 hover:bg-black/5 dark:text-gray-500 dark:hover:bg-white/5"
                >
                  Custom...
                </button>
                {task.duration_minutes && (
                  <button
                    onClick={() => {
                      onUpdate(task.id, { duration_minutes: null });
                      setShowDurationDropdown(false);
                    }}
                    className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-[10px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 p-1">
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={customVal}
                  placeholder="Minutes"
                  autoFocus
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      setShowDurationDropdown(false);
                    }
                    if (e.key === "Escape") setShowCustomInput(false);
                  }}
                  className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
                />
                <div className="mt-1 flex justify-between gap-1">
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="cursor-pointer px-1 py-0.5 text-[9px] font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      const val = parseInt(customVal);
                      onUpdate(task.id, { duration_minutes: val > 0 ? val : null });
                      setShowDurationDropdown(false);
                    }}
                    className="cursor-pointer px-1.5 py-0.5 text-[9px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {task.scheduled_time && (
        <>
          <button
            ref={timeRef}
            onClick={(e) => {
              e.stopPropagation();
              if (showTimeMenu) {
                setShowTimeMenu(false);
                return;
              }
              const rect = timeRef.current?.getBoundingClientRect();
              if (rect) setTimeMenuPos({ top: rect.bottom + 6, left: rect.left });
              setShowTimeMenu(true);
            }}
            title="Clear time"
            className="flex-shrink-0 cursor-pointer rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-500 tabular-nums transition-colors hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
          >
            {formatTime(task.scheduled_time)}
          </button>
          {showTimeMenu &&
            timeMenuPos &&
            createPortal(
              <div
                ref={timeMenuRef}
                style={{
                  position: "fixed",
                  top: timeMenuPos.top,
                  left: timeMenuPos.left,
                  zIndex: 9999,
                }}
                className="glass-card-strong min-w-[130px] rounded-lg border border-black/5 py-1 shadow-lg dark:border-white/5"
              >
                <button
                  onClick={() => {
                    onUpdate(task.id, { scheduled_time: null });
                    setShowTimeMenu(false);
                  }}
                  className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  Clear time
                </button>
              </div>,
              document.body,
            )}
        </>
      )}

      {onMoveTaskBetweenAreas &&
        (() => {
          const taskTags = getTagsForIdea?.(task.id) ?? [];
          const nonSystemTags = taskTags.filter((t) => !t.is_system);
          return (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                ref={areaDotRef}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showAreaPicker) {
                    setShowAreaPicker(false);
                    return;
                  }
                  const rect = areaDotRef.current?.getBoundingClientRect();
                  if (rect) setAreaPickerPos({ top: rect.bottom + 4, left: rect.left });
                  setShowAreaPicker(true);
                }}
                className="h-2 w-2 flex-shrink-0 cursor-pointer rounded-full transition-transform hover:scale-150"
                style={{ background: areaColors[area]?.dot }}
                title="Change area"
              />
              {nonSystemTags.map((tag) => (
                <span
                  key={tag.id}
                  className="flex-shrink-0 rounded-full px-1 py-0.5 text-[9px] font-bold"
                  style={{
                    background: `${areaColors[tag.area]?.dot}15`,
                    color: areaColors[tag.area]?.dot,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          );
        })()}

      <NotesIndicator hasNotes={!!task.notes?.trim()} onClick={() => openNotes(task.id)} />
      <div className="flex flex-shrink-0 items-center gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100">
        <button
          onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
          className={`cursor-pointer ${task.is_priority ? "text-amber-400" : "text-gray-300 hover:text-gray-400 dark:text-gray-600"}`}
        >
          <Star size={12} className={task.is_priority ? "fill-amber-400 text-amber-400" : ""} />
        </button>

        <div className="relative">
          <button
            ref={menuTriggerRef}
            onClick={() => {
              if (showMenu) {
                setShowMenu(false);
                return;
              }
              const rect = menuTriggerRef.current?.getBoundingClientRect();
              if (rect) setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
              setShowDateInput(false);
              setShowMenu(true);
            }}
            className="cursor-pointer text-gray-300 hover:text-gray-500 md:opacity-50 md:hover:opacity-100 dark:text-gray-600"
          >
            <MoreHorizontal size={13} />
          </button>
          {showMenu &&
            menuPos &&
            createPortal(
              <div
                ref={menuRef}
                style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                className="glass-card-strong min-w-[160px] rounded-lg border border-black/5 py-1 shadow-lg dark:border-white/5"
              >
                <button
                  onClick={() => {
                    const rect = menuTriggerRef.current?.getBoundingClientRect();
                    if (rect)
                      setRevealPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
                    setShowMenu(false);
                    setShowReveal(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                >
                  <Eye size={11} strokeWidth={1.5} />
                  Reveal in...
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                {task.scheduled_date !== getToday() && (
                  <button
                    onClick={() => {
                      void onReschedule(
                        task.id,
                        isReschedule
                          ? { type: "retry_today" }
                          : { type: "move", newDate: getToday() },
                      );
                      setShowMenu(false);
                    }}
                    className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    {dateActionLabel} to Today
                  </button>
                )}
                <button
                  onClick={() => setShowDateInput((v) => !v)}
                  className={`flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold ${
                    showDateInput
                      ? "bg-violet-50 text-violet-600 dark:bg-violet-950/20 dark:text-violet-400"
                      : "text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {dateActionLabel} Date…
                </button>
                {showDateInput && (
                  <div className="px-2.5 pb-1.5">
                    <input
                      ref={dateInputRef}
                      type="date"
                      autoFocus
                      className="w-full rounded-lg border border-black/10 bg-white/80 px-2 py-1.5 text-xs text-gray-800 focus:ring-1 focus:ring-violet-500 focus:outline-none dark:border-white/10 dark:bg-gray-800/80 dark:text-gray-200"
                      onChange={(e) => {
                        if (e.target.value) {
                          void onReschedule(
                            task.id,
                            isReschedule
                              ? { type: "reschedule", newDate: e.target.value }
                              : { type: "move", newDate: e.target.value },
                          );
                          setShowMenu(false);
                        }
                      }}
                    />
                  </div>
                )}
                {task.scheduled_time && (
                  <button
                    onClick={() => {
                      onUpdate(task.id, { scheduled_time: null });
                      setShowMenu(false);
                    }}
                    className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.04]"
                  >
                    Clear time
                  </button>
                )}
                {task.productivity_signal && (
                  <button
                    onClick={() => {
                      const oldSignal = task.productivity_signal;
                      onUpdate(task.id, { productivity_signal: null });
                      onUndoAction?.({
                        label: "Cleared productivity signal",
                        run: async () => {
                          onUpdate(task.id, { productivity_signal: oldSignal });
                        },
                      });
                      setShowMenu(false);
                    }}
                    className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold text-gray-500 hover:bg-black/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.04]"
                  >
                    Clear signal
                  </button>
                )}
                <button
                  onClick={() => {
                    const oldSignal = task.productivity_signal;
                    const newSignal = task.productivity_signal === "lazy" ? "productive" : "lazy";
                    onUpdate(task.id, { productivity_signal: newSignal });
                    onUndoAction?.({
                      label: `Marked as ${newSignal === "lazy" ? "Lazy" : "Productive"}`,
                      run: async () => {
                        onUpdate(task.id, { productivity_signal: oldSignal });
                      },
                    });
                    setShowMenu(false);
                  }}
                  className={`flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                    task.productivity_signal === "lazy"
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  {task.productivity_signal === "lazy"
                    ? "🎯 Mark as Productive"
                    : "☕ Mark as Lazy"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full cursor-pointer px-3 py-1.5 text-left text-[11px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Delete
                </button>
              </div>,
              document.body,
            )}

          {showDeleteConfirm &&
            createPortal(
              <div
                ref={deleteConfirmRef}
                style={{
                  position: "fixed",
                  top: menuPos ? menuPos.top : 0,
                  right: menuPos ? menuPos.right : 0,
                  zIndex: 10001,
                }}
                className="glass-card-strong min-w-[180px] rounded-xl border border-red-200 p-2 shadow-lg dark:border-red-500/30"
              >
                <p className="px-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                  Delete this task?
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="cursor-pointer rounded-lg px-2 py-1 text-[11px] text-gray-600 hover:bg-black/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onDelete(task.id);
                      setShowDeleteConfirm(false);
                    }}
                    className="cursor-pointer rounded-lg bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>,
              document.body,
            )}
          {showReveal && revealPos && (
            <RevealInMenu
              idea={task}
              currentView="planner"
              position={revealPos}
              onClose={() => setShowReveal(false)}
            />
          )}
        </div>
      </div>

      {showAreaPicker &&
        areaPickerPos &&
        createPortal(
          <div
            ref={areaPickerRef}
            style={{
              position: "fixed",
              top: areaPickerPos.top,
              left: areaPickerPos.left,
              zIndex: 10000,
            }}
          >
            <TagPicker
              allTags={allTags ?? []}
              selectedTags={taskTags}
              onAdd={handleTagSelected}
              onRemove={async (tagId) => {
                if (onRemoveTag) await onRemoveTag(task.id, tagId);
                setShowAreaPicker(false);
              }}
              onCreateTag={onCreateTag ?? (async () => null)}
              onClose={() => setShowAreaPicker(false)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
