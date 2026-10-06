import type { Idea } from "@/lib/types";
import { getToday, addDays, getCurrentTimeRounded } from "@/lib/dateUtils";

export function computeCompletePatch(): Partial<Idea> {
  return {
    status: "completed",
    completed_at: new Date().toISOString(),
    cancelled_at: null,
    paused_at: null,
  };
}

export function computeCancelPatch(): Partial<Idea> {
  return {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    completed_at: null,
    paused_at: null,
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
  | { type: "reschedule"; newDate: string; time?: string; recordAttempt?: boolean }
  | { type: "defer" };

/**
 * Single predicate shared by labels and patch computation so consequence
 * previews cannot drift from behavior. Records only when the old date is
 * STRICTLY in the past (today is not a miss) and the date actually changes.
 */
export function willRecordAttempt(
  previousDate: string | null,
  newDate: string | null,
  attemptDates: string[],
  today: string = getToday(),
): boolean {
  return (
    previousDate != null &&
    previousDate < today &&
    newDate !== previousDate &&
    !attemptDates.includes(previousDate)
  );
}

export function computeReschedulePatch(idea: Idea, action: RescheduleAction): Partial<Idea> {
  if (action.type === "defer") {
    const previousDate = idea.scheduled_date;
    const updatedAttemptDates =
      previousDate && willRecordAttempt(previousDate, null, idea.attempt_dates)
        ? [...idea.attempt_dates, previousDate]
        : idea.attempt_dates;
    return {
      scheduled_date: null,
      status: "deferred",
      attempt_dates: updatedAttemptDates,
      completed_at: null,
      cancelled_at: null,
      paused_at: null,
    };
  }

  const previousDate = idea.scheduled_date;
  const nextDate = action.newDate;
  const today = getToday();
  const record =
    action.recordAttempt ?? willRecordAttempt(previousDate, nextDate, idea.attempt_dates, today);
  const updatedAttemptDates =
    record && previousDate ? [...idea.attempt_dates, previousDate] : idea.attempt_dates;

  const patch: Partial<Idea> = {
    scheduled_date: nextDate,
    status: "scheduled",
    attempt_dates: updatedAttemptDates,
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
  };
  if (action.time !== undefined) {
    patch.scheduled_time = action.time;
  }
  return patch;
}

/** Clearing the date keeps the status but records the old date only if strictly in the past. */
export function computeClearDatePatch(idea: Idea): Partial<Idea> {
  const previousDate = idea.scheduled_date;
  return {
    scheduled_date: null,
    attempt_dates:
      previousDate && willRecordAttempt(previousDate, null, idea.attempt_dates)
        ? [...idea.attempt_dates, previousDate]
        : idea.attempt_dates,
  };
}

/** Convenience action builders. */
export function carryToTodayAction(recordAttempt?: boolean): RescheduleAction {
  return { type: "reschedule", newDate: getToday(), recordAttempt };
}

export function tryNowAction(): RescheduleAction {
  return { type: "reschedule", newDate: getToday(), time: getCurrentTimeRounded(15) };
}

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
    if (
      !includeInactive &&
      (idea.status === "completed" || idea.status === "cancelled" || idea.status === "missed")
    )
      continue;
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
  return (
    task.status !== "completed" &&
    task.status !== "cancelled" &&
    task.status !== "missed" &&
    task.status !== "archived"
  );
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
