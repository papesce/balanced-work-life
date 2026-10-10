import type { Idea } from "@/lib/types";

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
