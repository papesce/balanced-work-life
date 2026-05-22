"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { BalanceChart } from "@/components/BalanceChart";
import { TaskCard } from "@/components/TaskCard";
import { QuickAddButton } from "@/components/QuickAddButton";
import { Navigation } from "@/components/Navigation";

export default function TodayPage() {
  const { signOut } = useAuth();
  const { activeTasks, loading, createTask, updateTask, completeTask, deleteTask } =
    useTasks();
  const [detailed, setDetailed] = useState(false);

  const todayTasks = activeTasks.filter((t) => t.time_bucket === "today");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Today</h1>
        <button
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign Out
        </button>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <BalanceChart tasks={activeTasks} />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Today&apos;s Tasks ({todayTasks.length})
          </h2>
          <button
            onClick={() => setDetailed(!detailed)}
            className="text-xs text-indigo-600 font-medium"
          >
            {detailed ? "Glance" : "Details"}
          </button>
        </div>

        {todayTasks.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            No tasks for today. Tap + to add one.
          </p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) =>
              detailed ? (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={completeTask}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                />
              ) : (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm"
                >
                  <button
                    onClick={() => completeTask(task.id)}
                    className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-indigo-500 flex-shrink-0"
                    aria-label="Complete task"
                  />
                  <span className="text-sm text-gray-800 truncate">
                    {task.title}
                  </span>
                  <span
                    className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      task.balance_category === "work"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {task.balance_category}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </main>

      <QuickAddButton onAdd={createTask} />
      <Navigation />
    </div>
  );
}
