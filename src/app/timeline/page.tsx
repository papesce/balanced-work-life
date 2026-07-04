"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { useTags } from "@/hooks/useTags";
import { useTaskTags } from "@/hooks/useTaskTags";
import { AppShell } from "@/components/AppShell";
import { MiniBalanceBar } from "@/components/MiniBalanceBar";
import { Idea } from "@/lib/types";
import { getToday, getTomorrow, getDatesRange, isPast } from "@/lib/dateUtils";
import { DayTaskList } from "@/components/timeline/DayTaskList";
import { FloatingAddButton } from "@/components/timeline/FloatingAddButton";
import { QuickAddInput } from "@/components/timeline/QuickAddInput";
import { formatTimelineDate, getTimelineKicker } from "@/components/timeline/timelineUtils";

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
  const router = useRouter();
  const { ideas, loading, createIdea, markDone, markUndone, updateIdea, reorderTasks, smartSortTasks } = useIdeas();
  const tagsHook = useTags();
  const taskTagsHook = useTaskTags();
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
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: "planned" });
  };

  const handleFabAdd = async (text: string, date: string | null) => {
    await createIdea(text, null, "bottom", { type: "task", scheduled_date: date, status: date ? "planned" : "inbox" });
    setFabOpen(false);
  };

  const handleReorderDate = useCallback(
    (date: string) => (reordered: Idea[]) => { reorderTasks(reordered.map((t) => t.id)); },
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
          const unresolvedCount = dayTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled" && isPast(date)).length;

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
                      <span className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${
                        isTodayDate ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"
                      }`}>
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
                    <MiniBalanceBar tasks={dayTasks} getTagsForIdea={taskTagsHook.getTagsForIdea} date={date} />
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
                    <button onClick={() => router.push(`/?date=${date}`)} className="focus-button">
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
                      allTags={tagsHook.tags}
                      getTagsForIdea={taskTagsHook.getTagsForIdea}
                      onAddTag={taskTagsHook.addTagToTask}
                      onRemoveTag={taskTagsHook.removeTagFromTask}
                      onCreateTag={tagsHook.createTag}
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
