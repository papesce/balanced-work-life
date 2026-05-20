"use client";

import { useTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { QuickAddButton } from "@/components/QuickAddButton";
import { Navigation } from "@/components/Navigation";
import { TimeBucket } from "@/lib/types";

const BUCKETS: { key: TimeBucket; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "next_week", label: "Next Week" },
  { key: "backlog", label: "Backlog" },
];

export default function PlannerPage() {
  const { activeTasks, loading, createTask, updateTask, completeTask, deleteTask } =
    useTasks();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Planner</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-6">
        {BUCKETS.map(({ key, label }) => {
          const bucketTasks = activeTasks.filter((t) => t.time_bucket === key);
          return (
            <section key={key}>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                {label} ({bucketTasks.length})
              </h2>
              {bucketTasks.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No tasks</p>
              ) : (
                <div className="space-y-2">
                  {bucketTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={completeTask}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <QuickAddButton onAdd={createTask} />
      <Navigation />
    </div>
  );
}
