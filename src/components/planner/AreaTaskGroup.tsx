"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Reorder } from "framer-motion";
import { Check, Star, MoreHorizontal, GripVertical, Clock, Play, Pause, X } from "lucide-react";
import { areaColors } from "@/styles/tokens";
import { Idea, IdeaStatus, LifeArea } from "@/lib/types";
import { AREA_ICONS, AREA_LABELS } from "./constants";
import { formatTime } from "./plannerUtils";
import { StatusPicker } from "@/components/brainstorm/StatusPicker";

const STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string; icon: React.ElementType | null }> = {
  inbox:       { label: "Inbox",       color: "text-gray-400",              icon: null },
  planned:     { label: "Planned",     color: "text-sky-500",               icon: null },
  scheduled:   { label: "Scheduled",   color: "text-blue-500",              icon: null },
  in_progress: { label: "In Progress", color: "text-amber-500",             icon: Play },
  paused:      { label: "Paused",      color: "text-orange-400",            icon: Pause },
  completed:   { label: "Completed",   color: "text-violet-600",            icon: Check },
  cancelled:   { label: "Cancelled",   color: "text-red-500",               icon: X },
  archived:    { label: "Archived",    color: "text-gray-400",              icon: null },
};

interface AreaTaskGroupProps {
  area: LifeArea;
  activeDate: string;
  pendingTasks: Idea[];
  doneTasks: Idea[];
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  onAddTask: (text: string, area: LifeArea) => Promise<void>;
  onReorderTasks: (taskIds: string[]) => void;
}

export function AreaTaskGroup({
  area, activeDate, pendingTasks, doneTasks,
  onDone, onUndone, onUpdate, onDelete, onAddTask, onReorderTasks,
}: AreaTaskGroupProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const Icon = AREA_ICONS[area];
  const color = areaColors[area]?.dot;

  return (
    <div
      className={`glass-card rounded-2xl border border-black/5 dark:border-white/5 transition-all duration-200 ${
        isDragOver ? "ring-2 ring-violet-500/50 bg-violet-500/[0.03] scale-[1.005]" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) onUpdate(taskId, { status: "planned", scheduled_date: activeDate, scheduled_time: null });
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] rounded-t-2xl"
        style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" }}
      >
        <div className="w-5.5 h-5.5 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: areaColors[area]?.bg }}>
          <Icon size={12} style={{ color }} />
        </div>
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{AREA_LABELS[area]}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1 font-semibold">
          {pendingTasks.length} pending{doneTasks.length > 0 ? ` · ${doneTasks.length} completed` : ""}
        </span>
      </div>

      <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03]">
        {pendingTasks.length > 0 && (
          <PendingTaskList
            tasks={pendingTasks}
            onReorder={onReorderTasks}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        )}
        {doneTasks.map((task) => (
          <TaskRow key={task.id} task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div className="px-5 py-4 text-xs text-gray-400 dark:text-gray-500 italic">No tasks planned for this day</div>
        )}
      </div>

      <div className="px-4 py-2 bg-black/[0.01] dark:bg-white/[0.01] border-t border-black/[0.02] dark:border-white/[0.02] rounded-b-2xl">
        <input
          type="text"
          placeholder={`+ Add to ${AREA_LABELS[area]}...`}
          className="w-full bg-transparent border-none text-xs py-1.5 focus:ring-0 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-700 dark:text-gray-300 outline-none font-medium"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              void onAddTask(e.currentTarget.value.trim(), area);
              e.currentTarget.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}

function PendingTaskList({
  tasks, onReorder, onDone, onUndone, onUpdate, onDelete,
}: {
  tasks: Idea[];
  onReorder: (taskIds: string[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState(tasks);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setItems(tasks); }, [tasks]);

  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems}>
      {items.map((task) => (
        <Reorder.Item
          key={task.id}
          value={task}
          className="relative"
          onDragEnd={() => onReorder(itemsRef.current.map((t) => t.id))}
        >
          <TaskRow task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} onDelete={onDelete} showDragHandle />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

function TaskRow({
  task, onDone, onUndone, onUpdate, onDelete, showDragHandle,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onDelete: (id: string) => void;
  showDragHandle?: boolean;
}) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isPaused = task.status === "paused";
  const isInProgress = task.status === "in_progress";
  const statusConfig = STATUS_CONFIG[task.status];
  const [showMenu, setShowMenu] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customVal, setCustomVal] = useState(task.duration_minutes?.toString() ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const durationRef = useRef<HTMLDivElement>(null);

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
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) setShowDurationDropdown(false);
    };
    if (showMenu || showDurationDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu, showDurationDropdown]);

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
    }
    setShowStatusPicker(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex items-center gap-2 px-4 py-2.5 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors group cursor-grab active:cursor-grabbing"
    >
      {showDragHandle && (
        <div className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
          <GripVertical size={11} />
        </div>
      )}

      {statusConfig.icon && (
        <statusConfig.icon size={12} strokeWidth={2} className={`flex-shrink-0 ${statusConfig.color}`} />
      )}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirmEdit}
          className="flex-1 text-[13px] px-1.5 py-0.5 border border-violet-300 dark:border-violet-600 rounded-lg outline-none focus:border-violet-500 min-w-0 bg-white/80 dark:bg-gray-800/80 font-semibold"
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-1 text-[13px] min-w-0 truncate cursor-text hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded px-1 -mx-1 ${
            isCompleted ? "text-gray-400 dark:text-gray-500 font-normal" :
            isCancelled ? "text-red-400/60 font-normal" :
            isPaused ? "text-orange-600/70 dark:text-orange-400/70 font-semibold" :
            "text-gray-700 dark:text-gray-200 font-semibold"
          }`}
        >
          {task.text}
        </span>
      )}

      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowStatusPicker((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all cursor-pointer hover:opacity-80"
          style={{
            background: isCompleted ? "#f5f3ff" : isCancelled ? "#fef2f2" : isPaused ? "#fff7ed" : isInProgress ? "#fefce8" : "rgba(0,0,0,0.05)",
            color: isCompleted ? "#7c3aed" : isCancelled ? "#ef4444" : isPaused ? "#f97316" : isInProgress ? "#d97706" : "#9ca3af",
          }}
        >
          {statusConfig.label}
        </button>
        {showStatusPicker && (
          <div className="absolute right-0 top-full mt-1 z-50">
            <StatusPicker
              current={task.status}
              onSelect={handleStatusSelect}
              onClose={() => setShowStatusPicker(false)}
            />
          </div>
        )}
      </div>

      <div className="relative" ref={durationRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setShowDurationDropdown(!showDurationDropdown); setShowCustomInput(false); }}
          className={`text-[10px] tabular-nums font-bold flex-shrink-0 transition-colors rounded px-1.5 py-0.5 flex items-center gap-1 cursor-pointer ${
            task.duration_minutes
              ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-900/30"
              : "text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100"
          }`}
          title="Set task duration"
        >
          <Clock size={11} />
          {task.duration_minutes ? `${task.duration_minutes}m` : ""}
        </button>

        {showDurationDropdown && (
          <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-xl p-1.5 shadow-xl border border-black/5 dark:border-white/5 min-w-[110px] space-y-1">
            {!showCustomInput ? (
              <>
                {[15, 30, 45, 60, 90, 120].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => { onUpdate(task.id, { duration_minutes: preset }); setShowDurationDropdown(false); }}
                    className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 font-semibold cursor-pointer"
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
                <button onClick={() => setShowCustomInput(true)} className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 font-semibold cursor-pointer">
                  Custom...
                </button>
                {task.duration_minutes && (
                  <button
                    onClick={() => { onUpdate(task.id, { duration_minutes: null }); setShowDurationDropdown(false); }}
                    className="w-full text-left px-2 py-1 text-[10px] rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 p-1">
                <input
                  type="number" min="5" max="480" step="5"
                  value={customVal} placeholder="Minutes" autoFocus
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { const val = parseInt(customVal); onUpdate(task.id, { duration_minutes: val > 0 ? val : null }); setShowDurationDropdown(false); }
                    if (e.key === "Escape") setShowCustomInput(false);
                  }}
                  className="w-full text-[10px] border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 font-semibold"
                />
                <div className="flex justify-between gap-1 mt-1">
                  <button onClick={() => setShowCustomInput(false)} className="text-[9px] text-gray-400 hover:text-gray-600 px-1 py-0.5 cursor-pointer font-semibold">Back</button>
                  <button
                    onClick={() => { const val = parseInt(customVal); onUpdate(task.id, { duration_minutes: val > 0 ? val : null }); setShowDurationDropdown(false); }}
                    className="text-[9px] text-violet-600 dark:text-violet-400 hover:text-violet-700 px-1.5 py-0.5 font-bold cursor-pointer"
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
        <span className="text-[10px] text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/20 px-1.5 py-0.5 rounded flex-shrink-0 font-bold tabular-nums">
          {formatTime(task.scheduled_time)}
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
          className={`cursor-pointer ${task.is_priority ? "text-amber-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-400"}`}
        >
          <Star size={12} className={task.is_priority ? "fill-amber-400 text-amber-400" : ""} />
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 cursor-pointer">
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 z-50 glass-card-strong rounded-lg py-1 min-w-[150px] shadow-lg border border-black/5 dark:border-white/5">
              <button
                onClick={() => { onUpdate(task.id, { scheduled_date: null, status: "inbox" }); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-semibold cursor-pointer"
              >
                Move to Backlog
              </button>
              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
