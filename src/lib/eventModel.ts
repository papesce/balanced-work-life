import type { Idea } from "@/lib/types";
import { isEvent } from "@/lib/ideaPredicates";

export function selectEventsForRange(events: Idea[], start: string, end: string): Idea[] {
  return events.filter(
    (idea) =>
      isEvent(idea) &&
      idea.parent_id === null &&
      !!idea.scheduled_date &&
      idea.scheduled_date >= start &&
      idea.scheduled_date <= end,
  );
}

export function groupEventsByDate(events: Idea[]): Record<string, Idea[]> {
  const grouped: Record<string, Idea[]> = {};
  for (const event of events) {
    if (!isEvent(event) || !event.scheduled_date) continue;
    (grouped[event.scheduled_date] ??= []).push(event);
  }
  for (const dayEvents of Object.values(grouped)) {
    dayEvents.sort(
      (a, b) =>
        (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "") ||
        a.sort_order - b.sort_order,
    );
  }
  return grouped;
}

export function buildEventsQuery(
  userId: string,
  start: string,
  end: string,
): { sql: string; params: string[] } {
  return {
    sql: `SELECT * FROM ideas
          WHERE user_id = ? AND type = 'event' AND parent_id IS NULL
            AND scheduled_date >= ? AND scheduled_date <= ?
          ORDER BY scheduled_date ASC, scheduled_time ASC, sort_order ASC`,
    params: [userId, start, end],
  };
}
