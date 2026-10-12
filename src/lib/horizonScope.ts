import type { Idea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";

/**
 * Committed work: anything already decided into motion — scheduled,
 * in progress, or carrying a concrete date. It has a real home in
 * Planner/Today and is excluded from Horizon by default, where the job
 * is deciding *future* work.
 *
 * Uncommitted = draft/planned with no scheduled_date.
 */
export function isUncommitted(idea: Idea): boolean {
  return (idea.status === "draft" || idea.status === "planned") && idea.scheduled_date == null;
}

export function isCommitted(idea: Idea): boolean {
  return !isUncommitted(idea);
}

/** Pool filter: keep only the uncommitted items. */
export function filterUncommitted(pool: Idea[]): Idea[] {
  return pool.filter(isUncommitted);
}

/**
 * Overdue committed work: carries a scheduled_date strictly before today,
 * whatever the status. These are the items that need rescheduling — the
 * one committed bucket Horizon surfaces by default.
 *
 * Dates are "YYYY-MM-DD" strings, so plain comparison is chronological.
 */
export function isOverdueCommitted(idea: Idea, today: string = getToday()): boolean {
  return idea.scheduled_date != null && idea.scheduled_date < today;
}

/**
 * Upcoming / in-motion committed work: dated today or later, or undated
 * but already started (in_progress / scheduled status). Decided work with
 * a real home in Planner/Today — hidden from Horizon by default.
 */
export function isUpcomingCommitted(idea: Idea, today: string = getToday()): boolean {
  if (!isCommitted(idea) || isOverdueCommitted(idea, today)) return false;
  return true;
}

/** Pool filter: drop upcoming / in-motion committed items, keep the rest. */
export function filterOutUpcoming(pool: Idea[], today: string = getToday()): Idea[] {
  return pool.filter((i) => !isUpcomingCommitted(i, today));
}

/** Pool filter: drop overdue committed items, keep the rest. */
export function filterOutOverdue(pool: Idea[], today: string = getToday()): Idea[] {
  return pool.filter((i) => !isOverdueCommitted(i, today));
}
