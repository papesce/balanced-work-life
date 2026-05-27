"use client";

import { useState, useMemo } from "react";
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

const AREA_COLORS: Record<LifeArea, string> = {
  work: "bg-indigo-50 text-indigo-600",
  health: "bg-red-50 text-red-600",
  relationships: "bg-pink-50 text-pink-600",
  growth: "bg-amber-50 text-amber-600",
  finances: "bg-emerald-50 text-emerald-600",
  life: "bg-purple-50 text-purple-600",
};

function areaCounts(items: Idea[]): Record<LifeArea, number> {
  const counts: Record<LifeArea, number> = { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
  for (const item of items) {
    const area = item.area ?? "life";
    counts[area]++;
  }
  return counts;
}

export default function TodayPage() {
  const { ideas, loading, createIdea, updateIdea, markDone, markUndone, scheduleIdea } = useIdeas();
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
    const id = await createIdea(text, null, "top");
    if (id) {
      await updateIdea(id, { type: "task", area, scheduled_date: scheduledDate });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <AppShell title="Today" onAdd={handleAdd}>
      <div className="space-y-6">
        {/* Mode toggle */}
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                mode === key
                  ? "bg-white text-gray-900 font-medium shadow-sm border border-gray-200"
                  : "text-gray-500"
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
            <section key={group}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-gray-700">{group}</h2>
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1">
                {items.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm"
                  >
                    <button
                      onClick={() => markDone(idea.id)}
                      className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-indigo-500 flex-shrink-0 transition-colors"
                      aria-label="Complete task"
                    />
                    <span className="text-sm text-gray-800 truncate flex-1">
                      {idea.text}
                    </span>
                    {idea.area && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${AREA_COLORS[idea.area]}`}>
                        {idea.area}
                      </span>
                    )}
                    {group !== "Today" && (
                      <button
                        onClick={() => scheduleIdea(idea.id, today)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0"
                        title="Move to today"
                      >
                        → Today
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Completed today */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Completed today ({doneToday.length})
          </h2>
          {doneToday.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No tasks completed yet today</p>
          ) : (
            <div className="space-y-1">
              {doneToday.map((idea) => (
                <div
                  key={idea.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm"
                >
                  <button
                    onClick={() => markUndone(idea.id)}
                    className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0 flex items-center justify-center"
                    aria-label="Undo complete"
                  >
                    <span className="text-white text-xs">✓</span>
                  </button>
                  <span className="text-sm text-gray-500 line-through truncate flex-1">
                    {idea.text}
                  </span>
                  {idea.area && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${AREA_COLORS[idea.area]}`}>
                      {idea.area}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
