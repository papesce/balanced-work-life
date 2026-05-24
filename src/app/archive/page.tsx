"use client";

import { useMemo } from "react";
import { useTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { AppShell } from "@/components/AppShell";

export default function ArchivePage() {
  const { completedTasks, loading, updateTask, completeTask, deleteTask } = useTasks();

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof completedTasks> = {};
    for (const task of completedTasks) {
      const date = task.completed_at
        ? new Date(task.completed_at).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "Unknown";
      if (!groups[date]) groups[date] = [];
      groups[date].push(task);
    }
    return groups;
  }, [completedTasks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <AppShell title="Archive">
      <div className="space-y-6">
        {completedTasks.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            Completed tasks will appear here.
          </p>
        ) : (
          Object.entries(groupedByDate).map(([date, tasks]) => (
            <section key={date}>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                {date} ({tasks.length})
              </h2>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={completeTask}
                    onUpdate={updateTask}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
