"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useTasks } from "@/hooks/useTasks";
import { BalanceRing } from "@/components/BalanceRing";
import { AppShell } from "@/components/AppShell";
import { Task } from "@/lib/types";

type RingMode = "done" | "pending" | "total";

const MODES: { key: RingMode; label: string }[] = [
  { key: "done", label: "What I did" },
  { key: "pending", label: "What's left" },
  { key: "total", label: "Estimated total" },
];

const MODE_META: Record<RingMode, { desc: string; statLabel: string; statSub: string }> = {
  done: {
    desc: "Tasks completed today by category",
    statLabel: "Completed",
    statSub: "today",
  },
  pending: {
    desc: "Tasks still left to complete today",
    statLabel: "Pending",
    statSub: "left to do",
  },
  total: {
    desc: "Estimated total for the day (done + pending)",
    statLabel: "Total",
    statSub: "planned for today",
  },
};

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SummaryPage() {
  const { tasks, loading, createTask, completeTask } = useTasks();
  const [mode, setMode] = useState<RingMode>("done");

  const doneToday = useMemo(
    () => tasks.filter((t) => t.status === "done" && isToday(t.completed_at)),
    [tasks]
  );

  const activeToday = useMemo(
    () => tasks.filter((t) => t.time_bucket === "today" && t.status === "active"),
    [tasks]
  );

  const tomorrowTasks = useMemo(
    () => tasks.filter((t) => t.time_bucket === "tomorrow" && t.status === "active"),
    [tasks]
  );

  const ringData = useMemo(() => {
    let source: Task[];
    if (mode === "done") source = doneToday;
    else if (mode === "pending") source = activeToday;
    else source = [...doneToday, ...activeToday];

    return {
      workCount: source.filter((t) => t.balance_category === "work").length,
      lifeCount: source.filter((t) => t.balance_category === "life").length,
    };
  }, [mode, doneToday, activeToday]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  const meta = MODE_META[mode];

  const doneWork = doneToday.filter((t) => t.balance_category === "work");
  const doneLife = doneToday.filter((t) => t.balance_category === "life");

  return (
    <AppShell title="Today's Summary" onAdd={createTask}>
      <div className="space-y-5">
        {/* Segmented control */}
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
          workCount={ringData.workCount}
          lifeCount={ringData.lifeCount}
          modeLabel={meta.desc}
          statLabel={meta.statLabel}
          statSub={meta.statSub}
        />

        {/* Done today */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Completed today ({doneToday.length})
          </h2>
          {doneToday.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">
              No tasks completed yet today
            </p>
          ) : (
            <div className="space-y-1">
              {[...doneWork, ...doneLife].map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      task.balance_category === "work"
                        ? "bg-[#4F6BED]"
                        : "bg-[#1D9E75]"
                    }`}
                  />
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {task.title}
                  </span>
                  {task.completed_at && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatTime(task.completed_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Still active today */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Pending today
            </h2>
            {activeToday.length > 0 && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {activeToday.length}
              </span>
            )}
          </div>
          {activeToday.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">
              All done for today
            </p>
          ) : (
            <div className="space-y-1">
              {activeToday.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm"
                >
                  <button
                    onClick={() => completeTask(task.id)}
                    className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-indigo-500 flex-shrink-0 transition-colors"
                    aria-label="Complete task"
                  />
                  <span className="text-sm text-gray-800 truncate flex-1">
                    {task.title}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      task.balance_category === "work"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {task.balance_category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tomorrow preview */}
        {tomorrowTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">
                Tomorrow ({tomorrowTasks.length})
              </h2>
              {tomorrowTasks.length > 5 && (
                <Link
                  href="/planner"
                  className="text-xs text-indigo-600 font-medium"
                >
                  See all
                </Link>
              )}
            </div>
            <div className="space-y-1">
              {tomorrowTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 shadow-sm"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      task.balance_category === "work"
                        ? "bg-[#4F6BED]"
                        : "bg-[#1D9E75]"
                    }`}
                  />
                  <span className="text-sm text-gray-600 truncate">
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
