import { Idea } from "@/lib/types";
import { getToday, addDays } from "@/lib/dateUtils";

export function computeCompletePatch(): Partial<Idea> {
  return {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
}

export function computeCancelPatch(): Partial<Idea> {
  return {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    completed_at: null,
  };
}

export function getContextDate(idea: Idea): string {
  if (idea.scheduled_date) return idea.scheduled_date;
  if (idea.attempt_dates.length > 0) {
    return idea.attempt_dates[idea.attempt_dates.length - 1];
  }
  return idea.created_at;
}

export type RescheduleAction =
  | { type: "retry_today" }
  | { type: "reschedule"; newDate: string }
  | { type: "move"; newDate: string }
  | { type: "defer" };

export function computeReschedulePatch(idea: Idea, action: RescheduleAction): Partial<Idea> {
  const previousDate = idea.scheduled_date;
  const updatedAttemptDates = previousDate
    ? [...idea.attempt_dates, previousDate]
    : idea.attempt_dates;

  switch (action.type) {
    case "retry_today":
      return {
        scheduled_date: getToday(),
        status: "scheduled",
        attempt_dates: updatedAttemptDates,
      };
    case "reschedule":
      return {
        scheduled_date: action.newDate,
        status: "scheduled",
        attempt_dates: updatedAttemptDates,
      };
    case "move":
      return {
        scheduled_date: action.newDate,
        status: "scheduled",
      };
    case "defer":
      return {
        scheduled_date: null,
        status: "deferred",
        attempt_dates: updatedAttemptDates,
      };
  }
}

/** Convenience action builders for the triage queue. */
export function tomorrowAction(): RescheduleAction {
  return { type: "reschedule", newDate: addDays(getToday(), 1) };
}

export function nextWeekAction(): RescheduleAction {
  return { type: "reschedule", newDate: addDays(getToday(), 7) };
}

/**
 * A task may appear on a given day either as its current scheduled
 * occurrence or as a historical (deferred/moved) occurrence derived from
 * attempt_dates.
 */
export interface DayOccurrence {
  task: Idea;
  date: string;
  isHistorical: boolean;
}

/** Derives a task's historical occurrence dates from attempt_dates.
 *
 * Future moves are excluded (only past/today matter for triage), duplicate
 * dates are collapsed, and a date that is also the task's current scheduled
 * date is suppressed in favor of the active occurrence.
 */
export function getHistoricalOccurrenceDates(idea: Idea, today: string = getToday()): string[] {
  const current = idea.scheduled_date;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of idea.attempt_dates) {
    if (!d || d > today) continue;
    if (current && d === current) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

export function getDayOccurrences(
  ideas: Idea[],
  date: string,
  today: string = getToday(),
  includeInactive = false,
): DayOccurrence[] {
  const result: DayOccurrence[] = [];
  for (const idea of ideas) {
    if (idea.type !== "task" || idea.status === "archived") continue;
    if (!includeInactive && (idea.status === "completed" || idea.status === "cancelled")) continue;
    if (idea.scheduled_date === date) {
      result.push({ task: idea, date, isHistorical: false });
      continue;
    }
    if (getHistoricalOccurrenceDates(idea, today).includes(date)) {
      result.push({ task: idea, date, isHistorical: true });
    }
  }
  return result;
}

/** An active occurrence: any occurrence whose task is not completed,
 * cancelled, or archived. Used by the Timeline "Deferred" filter to show the
 * same view as All minus inactive tasks. */
export function isActiveOccurrence(occ: DayOccurrence): boolean {
  const { task } = occ;
  return task.status !== "completed" && task.status !== "cancelled" && task.status !== "archived";
}

export interface TriageMeta {
  originalDate: string | null;
  currentDate: string | null;
  attemptCount: number;
  movedToLabel: string;
}

/** Metadata shown on triage rows (original date, current date, age, attempts). */
export function getTriageMeta(idea: Idea): TriageMeta {
  const originalDate =
    idea.attempt_dates.length > 0
      ? idea.attempt_dates[0]
      : (idea.scheduled_date ?? idea.created_at.slice(0, 10));
  const currentDate = idea.scheduled_date;
  return {
    originalDate,
    currentDate,
    attemptCount: idea.attempt_dates.length,
    movedToLabel: currentDate ? `Moved to ${currentDate}` : "No date",
  };
}
