import type { Idea } from "@/lib/types";

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
