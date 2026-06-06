"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, MoreHorizontal, Check } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { AreaPicker } from "@/components/brainstorm/AreaPicker";
import { Idea, LifeArea } from "@/lib/types";
import {
  getToday,
  getDatesRange,
  formatDate,
  isPast,
} from "@/lib/dateUtils";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) =>
    ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
    }) as const,
};

export default function TimelinePage() {
  const { ideas, loading, createIdea, updateIdea, markDone, markUndone } = useIdeas();
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const todayRef = useRef<HTMLElement>(null);
  const hasAutoScrolled = useRef(false);

  const dates = useMemo(() => getDatesRange(3, 14), []);
  const today = getToday();

  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const inboxTasks = useMemo(
    () => tasks.filter((t) => !t.scheduled_date && t.status !== "completed"),
    [tasks]
  );

  const tasksByDate = useMemo(() => {
    const map: Record<string, Idea[]> = {};
    for (const task of tasks) {
      if (task.scheduled_date) {
        if (!map[task.scheduled_date]) map[task.scheduled_date] = [];
        map[task.scheduled_date].push(task);
      }
    }
    return map;
  }, [tasks]);

  const handleAdd = async (text: string, area: LifeArea, scheduledDate: string | null) => {
    await createIdea(text, null, "top", {
      type: "task",
      area,
      scheduled_date: scheduledDate,
      status: scheduledDate ? "scheduled" : "inbox",
    });
  };

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>, date: string | null) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      const text = e.currentTarget.value;
      e.currentTarget.value = "";
      await handleAdd(text, "life", date);
    }
  };

  const togglePriority = async (task: Idea) => {
    await updateIdea(task.id, { is_priority: !task.is_priority });
  };

  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!loading && !hasAutoScrolled.current) {
      const timer = setTimeout(() => {
        scrollToToday();
        hasAutoScrolled.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const headerActions = (
    <button
      onClick={scrollToToday}
      className="focus-button"
    >
      Jump to Today
    </button>
  );

  return (
    <AppShell title="Timeline" onAdd={handleAdd} headerActions={headerActions}>
      <div className="space-y-5 pb-20">
        {/* Inbox Section */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-[20px] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em]">
              Inbox
            </h2>
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
              {inboxTasks.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {inboxTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onDone={markDone}
                onUndone={markUndone}
                onUpdate={updateIdea}
                onTogglePriority={() => togglePriority(task)}
              />
            ))}
            <div className="task-input-wrapper">
              <input
                type="text"
                placeholder="+ Add to inbox..."
                className="w-full bg-transparent border-none text-sm py-1.5 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic"
                onKeyDown={(e) => handleQuickAdd(e, null)}
              />
              <div className="input-underline" />
            </div>
          </div>
        </motion.section>

        {/* Scrollable Days */}
        <div className="space-y-4">
          {dates.map((date, index) => {
            const dayTasks = tasksByDate[date] || [];
            const isTodayDate = date === today;
            const unresolvedCount = dayTasks.filter((t) => !t.done_at && isPast(date)).length;
            const isFocused = focusDay === date;
            const priorities = dayTasks.filter((t) => t.is_priority);

            return (
              <motion.section
                key={date}
                ref={isTodayDate ? todayRef : null}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <div
                  className={`rounded-[20px] transition-all ${
                    isTodayDate
                      ? "glass-card-today"
                      : "glass-card"
                  } ${isFocused ? "ring-2 ring-violet-400/30" : ""}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span
                          className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                            isTodayDate ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {isTodayDate ? "Today" : formatDate(date).split(",")[0]}
                        </span>
                        <span className="text-[22px] font-bold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
                          {formatDate(date).split(",")[1]?.trim() || formatDate(date)}
                        </span>
                      </div>
                      {unresolvedCount > 0 && (
                        <span className="bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                          {unresolvedCount} unresolved
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setFocusDay(isFocused ? null : date)}
                      className={`focus-button ${isFocused ? "active" : ""}`}
                    >
                      {isFocused ? "Close Focus" : "Focus"}
                    </button>
                  </div>

                  {/* Day Content */}
                  <div className="px-5 pb-4 space-y-2.5">
                    {/* Top Priorities in Normal Mode (Teaser) */}
                    {!isFocused && priorities.length > 0 && (
                      <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                        {priorities.map((p) => (
                          <div
                            key={p.id}
                            className="flex-shrink-0 flex items-center gap-1 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-full px-3 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                          >
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            <span className="truncate max-w-[120px]">{p.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1.5">No tasks planned</p>
                    ) : (
                      <div className="space-y-0.5">
                        {dayTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onDone={markDone}
                            onUndone={markUndone}
                            onUpdate={updateIdea}
                            onTogglePriority={() => togglePriority(task)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Focus Mode Expansion */}
                    {isFocused && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-4 border-t border-black/5 dark:border-white/5 space-y-5">
                          <div>
                            <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-3">
                              Top Priorities
                            </h3>
                            <div className="space-y-1.5">
                              {priorities.length === 0 ? (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No priorities set. Tap the star on a task to prioritize.</p>
                              ) : (
                                priorities.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-2.5 bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/40 dark:border-amber-700/20 rounded-xl p-2.5"
                                  >
                                    <Star size={14} className="fill-amber-400 text-amber-400 flex-shrink-0" />
                                    <span className="text-xs font-medium text-amber-900 dark:text-amber-300">{p.text}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-3">
                              Today&apos;s Schedule
                            </h3>
                            <div className="space-y-1">
                              {["09:00", "12:00", "15:00", "18:00"].map((time) => (
                                <div
                                  key={time}
                                  className="flex items-center gap-3 py-2 border-b border-black/5 dark:border-white/5"
                                >
                                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-10">
                                    {time}
                                  </span>
                                  <div className="flex-1 h-6 bg-black/[0.03] dark:bg-white/[0.04] rounded-lg border border-dashed border-black/10 dark:border-white/10" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Inline Add */}
                    <div className="task-input-wrapper pt-1">
                      <input
                        type="text"
                        placeholder={`+ Add task for ${isTodayDate ? "today" : formatDate(date).split(",")[1]?.trim() || date}...`}
                        className="w-full bg-transparent border-none text-sm py-1.5 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic"
                        onKeyDown={(e) => handleQuickAdd(e, date)}
                      />
                      <div className="input-underline" />
                    </div>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function TaskRow({
  task,
  onDone,
  onUndone,
  onUpdate,
  onTogglePriority,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  onTogglePriority: () => void;
}) {
  const isCompleted = !!task.done_at;
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const today = getToday();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowDatePicker(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: isCompleted ? 0.4 : 1,
        y: 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
        isHovered ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={() => (isCompleted ? onUndone(task.id) : onDone(task.id))}
        className="w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all relative"
        style={{
          borderColor: isCompleted ? "#7c3aed" : "var(--text-subtle)",
          background: isCompleted ? "#7c3aed" : "transparent",
        }}
        aria-label={isCompleted ? "Undo complete" : "Complete task"}
      >
        {isCompleted && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <Check size={10} strokeWidth={3} className="text-white" />
          </motion.span>
        )}
      </button>

      <motion.span
        animate={{
          textDecoration: isCompleted ? "line-through" : "none",
          color: isCompleted ? "rgba(107, 114, 128, 0.6)" : "var(--text-primary)",
        }}
        className="text-sm flex-1 truncate"
        style={{ fontWeight: 450 }}
      >
        {task.text}
      </motion.span>

      <button
        onClick={onTogglePriority}
        className={`transition-colors flex-shrink-0 ${
          task.is_priority ? "text-amber-400" : "text-gray-200 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-400"
        }`}
        aria-label={task.is_priority ? "Unmark priority" : "Mark priority"}
      >
        <Star
          size={14}
          strokeWidth={1.5}
          className={task.is_priority ? "fill-amber-400" : ""}
        />
      </button>

      <div className="relative">
        <button
          onClick={() => setShowAreaPicker(!showAreaPicker)}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
          style={{
            background: task.area ? `var(--area-${task.area}-bg)` : "var(--badge-bg)",
            color: task.area ? `var(--area-${task.area}-text)` : "var(--btn-default-text)",
          }}
        >
          {task.area || "Area"}
        </button>
        {showAreaPicker && (
          <AreaPicker
            current={task.area}
            onSelect={(area) => {
              onUpdate(task.id, { area });
              setShowAreaPicker(false);
            }}
            onClose={() => setShowAreaPicker(false)}
          />
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-all flex-shrink-0 ${
            isHovered || showMenu ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Task actions"
        >
          <MoreHorizontal size={16} strokeWidth={1.5} />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-50 glass-card-strong rounded-xl py-1.5 min-w-[170px] shadow-lg">
            <button
              onClick={() => {
                onUpdate(task.id, { scheduled_date: today, status: "scheduled" });
                setShowMenu(false);
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              Move to Today
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
              >
                Pick Date
              </button>
              {showDatePicker && (
                <div className="absolute left-full top-0 ml-2 z-50 glass-card-strong rounded-xl p-2 shadow-lg">
                  <input
                    type="date"
                    className="text-xs border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200"
                    onChange={(e) => {
                      if (e.target.value) {
                        onUpdate(task.id, { scheduled_date: e.target.value, status: "scheduled" });
                        setShowMenu(false);
                      }
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => {
                onUpdate(task.id, { scheduled_date: null, status: "inbox" });
                setShowMenu(false);
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              Move to Backlog
            </button>
            <div className="border-t border-black/5 dark:border-white/5 my-1" />
            <button
              onClick={() => {
                if (isCompleted) onUndone(task.id);
                else onDone(task.id);
                setShowMenu(false);
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              {isCompleted ? "Mark Undone" : "Mark Complete"}
            </button>
            <button
              onClick={() => {
                onUpdate(task.id, { status: "archived" });
                setShowMenu(false);
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-colors"
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
