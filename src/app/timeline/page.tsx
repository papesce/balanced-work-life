"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { Check, Star, MoreHorizontal, Plus, GripVertical, Sparkles } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { AppShell } from "@/components/AppShell";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { AreaPicker } from "@/components/brainstorm/AreaPicker";
import { Idea } from "@/lib/types";
import { getToday, getTomorrow, getDatesRange, isPast } from "@/lib/dateUtils";
import { areaColors } from "@/styles/tokens";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) =>
    ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
    }) as const,
};

function formatTimelineDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function getTimelineKicker(date: string, today: string, tomorrow: string): string {
  if (date === today) return "Today";
  if (date === tomorrow) return "Tomorrow";
  return date < today ? "Past" : "Upcoming";
}

export default function TimelinePage() {
  const router = useRouter();
  const { ideas, loading, createIdea, markDone, markUndone, updateIdea, reorderTasks, smartSortTasks } = useIdeas();
  const todayRef = useRef<HTMLElement>(null);
  const hasAutoScrolled = useRef(false);
  const [fabOpen, setFabOpen] = useState(false);

  const today = getToday();
  const tomorrow = getTomorrow();
  const dates = useMemo(() => getDatesRange(3, 14), []);
  const tasks = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

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

  useEffect(() => {
    if (!loading && !hasAutoScrolled.current) {
      const timer = setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        hasAutoScrolled.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleQuickAdd = async (text: string, date: string) => {
    await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: date,
      status: "scheduled",
    });
  };

  const handleFabAdd = async (text: string, date: string | null) => {
    await createIdea(text, null, "bottom", {
      type: "task",
      scheduled_date: date,
      status: date ? "scheduled" : "inbox",
    });
    setFabOpen(false);
  };

  const handleReorderDate = useCallback(
    (date: string) =>
      (reordered: Idea[]) => {
        reorderTasks(reordered.map((t) => t.id));
      },
    [reorderTasks],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const headerActions = (
    <button
      onClick={() => todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      className="focus-button"
    >
      Jump to Today
    </button>
  );

  return (
    <AppShell title="Timeline" headerActions={headerActions}>
      <div className="space-y-4 pb-24">
        {dates.map((date, index) => {
          const dayTasks = tasksByDate[date] ?? [];
          const isTodayDate = date === today;
          const dateLabel = formatTimelineDate(date);
          const timelineKicker = getTimelineKicker(date, today, tomorrow);
          const unresolvedCount = dayTasks.filter((t) => !t.done_at && isPast(date)).length;

          return (
            <motion.section
              key={date}
              ref={isTodayDate ? todayRef : null}
              custom={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="relative"
              style={{ zIndex: 20 - index }}
            >
              <div className={`rounded-[20px] transition-all ${isTodayDate ? "glass-card-today" : "glass-card"}`}>
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span
                        className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                          isTodayDate ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {timelineKicker}
                      </span>
                      <span className="text-[22px] font-bold text-gray-900 dark:text-gray-100 leading-tight">
                        {dateLabel}
                      </span>
                    </div>
                    {unresolvedCount > 0 && (
                      <span className="bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
                        {unresolvedCount} unresolved
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBalanceBar tasks={dayTasks} />
                    {dayTasks.length > 0 && (
                      <button
                        onClick={() => smartSortTasks(dayTasks)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/20 px-2 py-1 rounded-lg transition-all"
                        title="Sort tasks by priority score (effort × impact × urgency)"
                      >
                        <Sparkles size={12} />
                        <span className="hidden sm:inline">Smart Sort</span>
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/?date=${date}`)}
                      className="focus-button"
                    >
                      Plan
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-2">
                  {dayTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">No tasks planned</p>
                  ) : (
                    <DayTaskList
                      tasks={dayTasks}
                      onReorder={handleReorderDate(date)}
                      onDone={markDone}
                      onUndone={markUndone}
                      onUpdate={updateIdea}
                      today={today}
                    />
                  )}
                </div>

                <div className="px-5 pb-4 pt-1">
                  <QuickAddInput
                    placeholder={`+ Add task for ${isTodayDate ? "today" : dateLabel}...`}
                    onAdd={(text) => handleQuickAdd(text, date)}
                  />
                </div>
              </div>
            </motion.section>
          );
        })}
      </div>

      {/* FAB */}
      <FloatingAddButton
        open={fabOpen}
        onOpen={() => setFabOpen(true)}
        onClose={() => setFabOpen(false)}
        onAdd={handleFabAdd}
        today={today}
      />
    </AppShell>
  );
}

// ─── Floating Add Button ──────────────────────────────────────────────────────

function FloatingAddButton({
  open,
  onOpen,
  onClose,
  onAdd,
  today,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (text: string, date: string | null) => Promise<void>;
  today: string;
}) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"today" | "tomorrow" | "inbox">("today");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setText(""); setWhen("today"); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const date = when === "today" ? today : when === "tomorrow" ? getTomorrow() : null;
    await onAdd(text.trim(), date);
  };

  const tomorrow = getTomorrow();

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-24 right-6 z-50 w-80 glass-card-strong rounded-2xl p-4 shadow-2xl border border-white/20 dark:border-white/10"
            >
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-white/60 dark:bg-gray-800/60 border border-black/10 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-violet-500/30 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-500"
                />

                {/* When picker */}
                <div className="flex gap-1.5">
                  {(["today", "tomorrow", "inbox"] as const).map((opt) => {
                    const labels = {
                      today: `Today · ${today.slice(8)}/${today.slice(5, 7)}`,
                      tomorrow: `Tomorrow · ${tomorrow.slice(8)}/${tomorrow.slice(5, 7)}`,
                      inbox: "No date",
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWhen(opt)}
                        className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition-all font-medium ${
                          when === opt
                            ? "bg-violet-100/80 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400"
                            : "border-black/10 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5"
                        }`}
                      >
                        {labels[opt]}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim()}
                    className="flex-1 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-all disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        onClick={open ? onClose : onOpen}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Add task"
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus size={22} strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </>
  );
}

// ─── Quick Add Input ──────────────────────────────────────────────────────────

function QuickAddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="task-input-wrapper">
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent border-none text-sm py-1.5 focus:ring-0 placeholder:text-gray-300 dark:placeholder:text-gray-600 italic outline-none"
        onKeyDown={async (e) => {
          const input = ref.current;
          if (e.key === "Enter" && input?.value.trim()) {
            await onAdd(input.value.trim());
            input.value = "";
          }
        }}
      />
      <div className="input-underline" />
    </div>
  );
}

// ─── Day Task List (draggable) ─────────────────────────────────────────────────

function DayTaskList({
  tasks,
  onReorder,
  onDone,
  onUndone,
  onUpdate,
  today,
}: {
  tasks: Idea[];
  onReorder: (reordered: Idea[]) => void;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  today: string;
}) {
  const controls = useDragControls();
  const [items, setItems] = useState(tasks);
  const itemsRef = useRef(items);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { setItems(tasks); }, [tasks]);

  return (
    <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-0.5">
      {items.map((task) => (
        <Reorder.Item
          key={task.id}
          value={task}
          dragControls={controls}
          className="relative"
          onDragEnd={() => onReorder(itemsRef.current)}
        >
          <TimelineTaskRow
            task={task}
            onDone={onDone}
            onUndone={onUndone}
            onUpdate={onUpdate}
            today={today}
            dragControls={controls}
          />
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TimelineTaskRow({
  task,
  onDone,
  onUndone,
  onUpdate,
  today,
  dragControls,
}: {
  task: Idea;
  onDone: (id: string) => void;
  onUndone: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Idea>) => void;
  today: string;
  dragControls: ReturnType<typeof useDragControls>;
}) {
  const isCompleted = !!task.done_at;
  const [showMenu, setShowMenu] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const areaColor = task.area ? areaColors[task.area] : null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition-colors group ${
        isHovered ? "bg-black/[0.03] dark:bg-white/[0.04]" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <button
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>

      {/* Checkbox */}
      <button
        onClick={() => (isCompleted ? onUndone(task.id) : onDone(task.id))}
        className="w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
        style={{
          borderColor: isCompleted ? "#7c3aed" : "var(--text-subtle)",
          background: isCompleted ? "#7c3aed" : "transparent",
        }}
      >
        {isCompleted && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <Check size={10} strokeWidth={3} className="text-white" />
          </motion.span>
        )}
      </button>

      {/* Text */}
      <span
        className="flex-1 text-sm truncate"
        style={{
          fontWeight: 450,
          textDecoration: isCompleted ? "line-through" : "none",
          color: isCompleted ? "rgba(107, 114, 128, 0.6)" : "var(--text-primary)",
        }}
      >
        {task.text}
      </span>

      {/* Time */}
      {task.scheduled_time && (
        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold flex-shrink-0 tabular-nums">
          {task.scheduled_time.slice(0, 5)}
        </span>
      )}

      {/* Area chip — clickeable para cambiar área */}
      <div className="relative flex-shrink-0" ref={areaRef}>
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
            onSelect={(area) => {
              onUpdate(task.id, { area });
              setShowAreaPicker(false);
            }}
            onClose={() => setShowAreaPicker(false)}
          />
        )}
      </div>

      {/* Priority */}
      <button
        onClick={() => onUpdate(task.id, { is_priority: !task.is_priority })}
        className={`transition-colors flex-shrink-0 ${
          task.is_priority ? "text-amber-400" : "text-gray-200 dark:text-gray-600 hover:text-gray-400"
        }`}
      >
        <Star size={14} strokeWidth={1.5} className={task.is_priority ? "fill-amber-400" : ""} />
      </button>

      {/* Menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`text-gray-300 dark:text-gray-600 hover:text-gray-500 transition-all flex-shrink-0 ${
            isHovered || showMenu ? "opacity-100" : "opacity-0"
          }`}
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
                  if (e.target.value) {
                    onUpdate(task.id, { scheduled_date: e.target.value, status: "scheduled" });
                    setShowMenu(false);
                  }
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
