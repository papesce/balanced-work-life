"use client";

import { useTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { AppShell } from "@/components/AppShell";
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
    <AppShell title="Planner" onAdd={createTask}>
      <div className="space-y-6">
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
      </div>
    </AppShell>
  );
}
