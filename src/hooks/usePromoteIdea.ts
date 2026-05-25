"use client";

import { useState } from "react";
import { Task, TimeBucket, Idea, LifeArea, BalanceCategory } from "@/lib/types";

function areaToCategory(area: LifeArea | null): BalanceCategory {
  return area === "work" ? "work" : "life";
}

interface PromoteResult {
  status: "created" | "conflict";
  task?: Task;
  existingTask?: Task;
}

export function usePromoteIdea(
  activeTasksByIdeaId: Map<string, Task>,
  createTask: (
    title: string,
    timeBucket: TimeBucket,
    balanceCategory: BalanceCategory,
    ideaId: string | null
  ) => Promise<Task | undefined>,
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
) {
  const [conflictState, setConflictState] = useState<{
    idea: Idea;
    existingTask: Task;
    targetBucket: TimeBucket;
  } | null>(null);

  const promote = async (
    idea: Idea,
    targetBucket: TimeBucket
  ): Promise<PromoteResult> => {
    const existing = activeTasksByIdeaId.get(idea.id);
    if (existing) {
      setConflictState({ idea, existingTask: existing, targetBucket });
      return { status: "conflict", existingTask: existing };
    }

    const category = areaToCategory(idea.area);
    const task = await createTask(idea.text, targetBucket, category, idea.id);
    return { status: "created", task };
  };

  const resolveConflict = async (action: "move") => {
    if (!conflictState) return;
    const { existingTask, targetBucket } = conflictState;
    if (action === "move") {
      await updateTask(existingTask.id, { time_bucket: targetBucket });
    }
    setConflictState(null);
  };

  const dismissConflict = () => {
    setConflictState(null);
  };

  return {
    promote,
    conflictState,
    resolveConflict,
    dismissConflict,
  };
}
