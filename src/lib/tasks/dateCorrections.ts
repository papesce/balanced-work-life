import type { Idea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";

/**
 * Date corrections for the DetailsDrawer "Dates & status" section.
 *
 * Unlike computeReschedulePatch (rescheduleTask.ts), these NEVER touch
 * attempt_dates implicitly and never call willRecordAttempt. They are
 * explicit fix-ups for wrong dates, so history stays clean.
 */

export function computeSetDateCorrection(nextDate: string | null): Partial<Idea> {
  return { scheduled_date: nextDate };
}

export function computeRemoveAttemptCorrection(
  idea: Pick<Idea, "attempt_dates">,
  dateToRemove: string,
): Partial<Idea> {
  return { attempt_dates: idea.attempt_dates.filter((d) => d !== dateToRemove) };
}

export function computeCompletedAtCorrection(completedAt: string | null): Partial<Idea> {
  return { completed_at: completedAt };
}

/** Local-noon ISO for a YYYY-MM-DD date (avoids midnight TZ shifts). */
export function noonIsoForDate(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

/**
 * One-tap quick assign from Horizon. Single write, no attempt_dates touch:
 * - done (default when date is past) → scheduled + completed_at = that date
 * - otherwise → scheduled, timestamps cleared
 * Mirrors the timeline past quick-add default (past = completed).
 */
export function computeQuickAssignPatch(
  date: string,
  options?: { markDone?: boolean; today?: string },
): Partial<Idea> {
  const today = options?.today ?? getToday();
  const done = options?.markDone ?? date < today;
  if (done) {
    return {
      scheduled_date: date,
      status: "completed",
      completed_at: noonIsoForDate(date),
      cancelled_at: null,
      paused_at: null,
    };
  }
  return {
    scheduled_date: date,
    status: "scheduled",
    completed_at: null,
    cancelled_at: null,
    paused_at: null,
  };
}
