import { Idea } from "@/lib/types";
import { getToday } from "@/lib/dateUtils";

export function computeCompletePatch(): Partial<Idea> {
  return {
    status: "completed",
    completed_at: new Date().toISOString(),
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
  | { type: "defer" };

export function computeReschedulePatch(
  idea: Idea,
  action: RescheduleAction,
): Partial<Idea> {
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
    case "defer":
      return {
        scheduled_date: null,
        status: "deferred",
        attempt_dates: updatedAttemptDates,
      };
  }
}
