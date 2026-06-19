"use client";

import { useState, useEffect, useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Check, Star, MoreHorizontal, GripVertical, Play, Pause, X } from "lucide-react";
import { areaColors } from "@/styles/tokens";
import { Idea, IdeaStatus } from "@/lib/types";
import { AreaPicker } from "@/components/brainstorm/AreaPicker";
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

interface DayTaskListProps {
  tasks: Idea[];
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  today: string;
}

export function DayTaskList({ tasks, onReorder, onDone, onUndone, onUpdate, today }: DayTaskListProps) {
  const [items, setItems] = useState(tasks);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setItems(tasks); }, [tasks]);

  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-0.5">
      {items.map((task) => (
        <DayTaskItem
          key={task.id}
          task={task}
          onReorder={() => onReorder(itemsRef.current)}
          onDone={onDone}
          onUndone={onUndone}
          onUpdate={onUpdate}
          today={today}
        />
      ))}
    </Reorder.Group>
  );
}

function DayTaskItem({
  task, onReorder, onDone, onUndone, onUpdate, today,
}: {
  task: Idea;
  onReorder: () => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  today: string;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={task} dragControls={controls} className="relative" onDragEnd={onReorder}>
      <TimelineTaskRow task={task} onDone={onDone} onUndone={onUndone} onUpdate={onUpdate} today={today} dragControls={controls} />
    </Reorder.Item>
  );
}

function TimelineTaskRow({
  task, onDone, onUndone, onUpdate, today, dragControls,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  today: string;
  dragControls: ReturnType<typeof useDragControls>;
}) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const isInProgress = task.status === "in_progress";
  const isPaused = task.status === "paused";
  const statusConfig = STATUS_CONFIG[task.status];
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const areaColor = task.area ? areaColors[task.area] : null;

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
        <statusConfig.icon size={12} strokeWidth={2} className={`flex-shrink-0 ${statusConfig.color}`} />
      )}
      <span
        className={`flex-1 text-sm truncate ${isCancelled ? "line-through text-red-400/60" : ""}`}
        style={{
          fontWeight: 450,
          textDecoration: isCancelled ? "line-through" : "none",
          color: isCompleted ? "rgba(107, 114, 128, 0.6)" : isCancelled ? "rgba(239, 68, 68, 0.5)" : isPaused ? "rgba(249, 115, 22, 0.7)" : "var(--text-primary)",
        }}
      >
        {task.text}
      </span>

      {task.scheduled_time && (
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex-shrink-0 tabular-nums">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}

      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowAreaPicker((v) => !v)}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize transition-opacity hover:opacity-80"
          style={
            areaColor
              ? { background: areaColor.bg, color: areaColor.text }
              : { background: "rgba(0,0,0,0.05)", color: "#9ca3af" }
          }
        >
          {task.area ?? "—"}
        </button>
        {showAreaPicker && (
          <AreaPicker
            current={task.area}
            onSelect={(area) => { onUpdate(task.id, { area }); setShowAreaPicker(false); }}
            onClose={() => setShowAreaPicker(false)}
          />
        )}
      </div>

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

      <button
        onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
        className={`transition-colors flex-shrink-0 ${task.is_priority ? "text-amber-400" : "text-gray-200 dark:text-gray-600 hover:text-gray-400"}`}
      >
        <Star size={14} strokeWidth={1.5} className={task.is_priority ? "fill-amber-400" : ""} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-all flex-shrink-0 ${isHovered || showMenu ? "opacity-100" : "opacity-0"}`}
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-50 glass-card-strong rounded-xl py-1.5 min-w-[160px] shadow-lg">
            {task.scheduled_date !== today && (
              <button
                onClick={() => { onUpdate(task.id, { scheduled_date: today, status: "scheduled" }); setShowMenu(false); }}
                className="flex w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                Move to Today
              </button>
            )}
            <div className="relative group/date">
              <button className="flex w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                Pick Date
              </button>
              <input
                type="date"
                className="absolute left-full top-0 ml-1 opacity-0 w-0 h-0 pointer-events-none group-hover/date:opacity-100 group-hover/date:w-auto group-hover/date:h-auto group-hover/date:pointer-events-auto text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                onChange={(e) => {
                  if (e.target.value) { onUpdate(task.id, { scheduled_date: e.target.value, status: "scheduled" }); setShowMenu(false); }
                }}
              />
            </div>
            <button
              onClick={() => { onUpdate(task.id, { scheduled_date: null, status: "inbox" }); setShowMenu(false); }}
              className="flex w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              Move to Inbox
            </button>

            <div className="border-t border-black/5 dark:border-white/5 my-1" />
            <button
              onClick={() => { onUpdate(task.id, { status: "archived" }); setShowMenu(false); }}
              className="flex w-full text-left px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20"
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
