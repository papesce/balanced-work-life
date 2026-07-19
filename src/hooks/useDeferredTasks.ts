"use client";

import { useMemo } from "react";
import { useIdeas } from "./useIdeas";
import { Idea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";

export interface AgeBucket {
  label: string;
  tasks: Idea[];
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function useDeferredTasks() {
  const { ideas, loading } = useIdeas();
  const today = getToday();

  const taskIdeas = useMemo(() => ideas.filter((i) => i.type === "task"), [ideas]);

  const overdueBuckets = useMemo<AgeBucket[]>(() => {
    const overdue = taskIdeas.filter(
      (t) =>
        t.scheduled_date &&
        t.scheduled_date < today &&
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.status !== "archived",
    );

    const buckets: Record<string, Idea[]> = {
      "Ayer": [],
      "Hace 2-3 días": [],
      "Hace 4-7 días": [],
      "Más de una semana": [],
    };

    for (const task of overdue) {
      const age = daysBetween(task.scheduled_date!, today);
      if (age === 1) {
        buckets["Ayer"].push(task);
      } else if (age >= 2 && age <= 3) {
        buckets["Hace 2-3 días"].push(task);
      } else if (age >= 4 && age <= 7) {
        buckets["Hace 4-7 días"].push(task);
      } else {
        buckets["Más de una semana"].push(task);
      }
    }

    return Object.entries(buckets)
      .filter(([, tasks]) => tasks.length > 0)
      .map(([label, tasks]) => ({
        label,
        tasks: tasks.sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "")),
      }));
  }, [taskIdeas, today]);

  const deferredTasks = useMemo(
    () =>
      taskIdeas
        .filter((t) => t.status === "deferred")
        .sort((a, b) => {
          const aLast = a.attempt_dates[a.attempt_dates.length - 1] ?? "";
          const bLast = b.attempt_dates[b.attempt_dates.length - 1] ?? "";
          return bLast.localeCompare(aLast);
        }),
    [taskIdeas],
  );

  return { overdueBuckets, deferredTasks, loading };
}
