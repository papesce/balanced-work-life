"use client";

import type { Idea } from "@/lib/types";

/**
 * Status transitions built on updateIdea: done/undone/in-progress/paused/
 * cancelled/missed plus date scheduling with attempt tracking.
 */
export function useIdeaStatus({
  ideas,
  updateIdea,
}: {
  ideas: Idea[];
  updateIdea: (id: string, updates: Partial<Idea>) => Promise<void>;
}) {
  const markDone = async (id: string) => {
    const now = new Date().toISOString();
    await updateIdea(id, {
      status: "completed",
      completed_at: now,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markUndone = async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    const fallbackStatus = idea?.scheduled_date
      ? idea?.scheduled_time
        ? "scheduled"
        : "planned"
      : "draft";
    await updateIdea(id, {
      status: fallbackStatus,
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markInProgress = async (id: string) => {
    await updateIdea(id, {
      status: "in_progress",
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    });
  };

  const markPaused = async (id: string) => {
    await updateIdea(id, {
      status: "paused",
      paused_at: new Date().toISOString(),
      completed_at: null,
      cancelled_at: null,
    });
  };

  const markCancelled = async (id: string) => {
    await updateIdea(id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      completed_at: null,
      paused_at: null,
    });
  };

  const markMissed = async (id: string) => {
    const idea = ideas.find((i) => i.id === id);
    const updates: Partial<Idea> = {
      status: "missed",
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    };
    // Keep the scheduled date as evidence, but record it as an attempt
    // so the miss shows up in history / "go to last attempt".
    if (idea?.scheduled_date && !(idea.attempt_dates ?? []).includes(idea.scheduled_date)) {
      updates.attempt_dates = [...(idea.attempt_dates ?? []), idea.scheduled_date];
    }
    await updateIdea(id, updates);
  };

  const scheduleIdea = async (id: string, date: string | null) => {
    const idea = ideas.find((i) => i.id === id);
    const previousDate = idea?.scheduled_date;
    if (previousDate && previousDate !== date) {
      await updateIdea(id, {
        scheduled_date: date,
        attempt_dates: [...(idea.attempt_dates ?? []), previousDate],
      });
    } else {
      await updateIdea(id, { scheduled_date: date });
    }
  };

  return {
    markDone,
    markUndone,
    markInProgress,
    markPaused,
    markCancelled,
    markMissed,
    scheduleIdea,
  };
}
