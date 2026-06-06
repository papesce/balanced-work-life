"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useIdeas } from "@/hooks/useIdeas";
import { BalanceRing } from "@/components/BalanceRing";
import { AppShell } from "@/components/AppShell";
import { Idea, LifeArea } from "@/lib/types";
import { getToday, getScheduleGroup, isToday, ScheduleGroup } from "@/lib/dateUtils";

type RingMode = "done" | "pending" | "total";

const MODES: { key: RingMode; label: string }[] = [
  { key: "done", label: "What I did" },
  { key: "pending", label: "What's left" },
  { key: "total", label: "Estimated total" },
];

const MODE_META: Record<RingMode, { desc: string; statLabel: string; statSub: string }> = {
  done: { desc: "Tasks completed today by area", statLabel: "Completed", statSub: "today" },
  pending: { desc: "Tasks still left to complete today", statLabel: "Pending", statSub: "left to do" },
  total: { desc: "Estimated total for the day (done + pending)", statLabel: "Total", statSub: "planned for today" },
};

const GROUP_ORDER: ScheduleGroup[] = ["Today", "Tomorrow", "This week", "Later", "Unscheduled"];

function areaStyle(area: LifeArea): React.CSSProperties {
  return {
    background: `var(--area-${area}-bg)`,
    color: `var(--area-${area}-text)`,
  };
}

function areaCounts(items: Idea[]): Record<LifeArea, number> {
  const counts: Record<LifeArea, number> = { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
  for (const item of items) {
    const area = item.area ?? "life";
    counts[area]++;
  }
  return counts;
}

export default function TodayPage() {
  const { ideas, loading, createIdea, markDone, markUndone, scheduleIdea } = useIdeas();
  const [mode, setMode] = useState<RingMode>("done");

  const today = getToday();

  const taskIdeas = useMemo(
    () => ideas.filter((i) => i.type === "task"),
    [ideas]
  );

  const activeTaskIdeas = useMemo(
    () => taskIdeas.filter((i) => !i.done_at),
    [taskIdeas]
  );

  const doneToday = useMemo(
    () => taskIdeas
      .filter((i) => i.done_at && isToday(i.done_at))
      .sort((a, b) => b.done_at!.localeCompare(a.done_at!)),
    [taskIdeas]
  );

  const pendingToday = useMemo(
    () => activeTaskIdeas.filter((i) => i.scheduled_date === today),
    [activeTaskIdeas, today]
  );

  const grouped = useMemo(() => {
    const groups: Record<ScheduleGroup, Idea[]> = {
      "Today": [], "Tomorrow": [], "This week": [], "Later": [], "Unscheduled": [],
    };
    for (const idea of activeTaskIdeas) {
      const group = getScheduleGroup(idea.scheduled_date);
      groups[group].push(idea);
    }
    return groups;
  }, [activeTaskIdeas]);

  const ringData = useMemo(() => {
    if (mode === "done") return areaCounts(doneToday);
    if (mode === "pending") return areaCounts(pendingToday);
    return areaCounts([...doneToday, ...pendingToday]);
  }, [mode, doneToday, pendingToday]);

  const meta = MODE_META[mode];

  const handleAdd = async (text: string, area: LifeArea, scheduledDate: string | null) => {
    await createIdea(text, null, "top", {
      type: "task",
      area,
      scheduled_date: scheduledDate,
      status: scheduledDate ? "scheduled" : "inbox",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <AppShell title="Today" onAdd={handleAdd}>
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="flex gap-0.5 bg-white/60 dark:bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-white/20 dark:border-white/5 shadow-sm">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-all ${
                mode === key
                  ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium shadow-sm border border-gray-200/60 dark:border-gray-600"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Balance ring */}
        <BalanceRing
          counts={ringData}
          modeLabel={meta.desc}
          statLabel={meta.statLabel}
          statSub={meta.statSub}
        />

        {/* Active tasks grouped by schedule */}
        {GROUP_ORDER.map((group) => {
          const items = grouped[group];
          if (items.length === 0) return null;
          return (
            <motion.section
              key={group}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400">{group}</h2>
                <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-100/60 dark:bg-violet-500/20 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((idea) => (
                  <div
                    key={idea.id}
                    className="glass-card rounded-[16px] px-4 py-2.5 flex items-center gap-3"
                  >
                    <button
                      onClick={() => markDone(idea.id)}
                      className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-violet-500 flex-shrink-0 transition-colors"
                      aria-label="Complete task"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1" style={{ fontWeight: 450 }}>
                      {idea.text}
                    </span>
                    {idea.area && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={areaStyle(idea.area)}
                      >
                        {idea.area}
                      </span>
                    )}
                    {group !== "Today" && (
                      <button
                        onClick={() => scheduleIdea(idea.id, today)}
                        className="text-[11px] text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 font-medium flex-shrink-0 transition-colors"
                        title="Move to today"
                      >
                        → Today
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          );
        })}

        {/* Completed today */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2.5">
            Completed today ({doneToday.length})
          </h2>
          {doneToday.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-2 italic">No tasks completed yet today</p>
          ) : (
            <div className="space-y-1.5">
              {doneToday.map((idea) => (
                <div
                  key={idea.id}
                  className="glass-card rounded-[16px] px-4 py-2.5 flex items-center gap-3"
                >
                  <button
                    onClick={() => markUndone(idea.id)}
                    className="w-[18px] h-[18px] bg-violet-600 rounded-full flex-shrink-0 flex items-center justify-center"
                    aria-label="Undo complete"
                  >
                    <Check size={10} strokeWidth={3} className="text-white" />
                  </button>
                  <span className="text-sm text-gray-400 dark:text-gray-500 line-through truncate flex-1" style={{ opacity: 0.6 }}>
                    {idea.text}
                  </span>
                  {idea.area && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={areaStyle(idea.area)}
                    >
                      {idea.area}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </AppShell>
  );
}
