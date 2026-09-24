"use client";

/**
 * Single source of truth for the `ideas` INSERT column list and param order.
 * Previously duplicated (with hand-kept order) between useIdeas.createIdea
 * and the quick-note line resolver — a schema change to one silently broke
 * the other.
 */

export const IDEA_INSERT_COLUMNS = [
  "id",
  "user_id",
  "parent_id",
  "text",
  "description",
  "type",
  "effort",
  "impact",
  "urgency",
  "scheduled_date",
  "scheduled_time",
  "duration_minutes",
  "is_priority",
  "priority_order",
  "status",
  "notes",
  "completed_at",
  "cancelled_at",
  "paused_at",
  "attempt_dates",
  "status_history",
  "in_focus",
  "in_focus_until",
  "productivity_signal",
  "sort_order",
  "created_at",
  "updated_at",
] as const;

export function ideaInsertSql(): string {
  const cols = IDEA_INSERT_COLUMNS.join(", ");
  const placeholders = IDEA_INSERT_COLUMNS.map(() => "?").join(",");
  return `INSERT INTO ideas (${cols}) VALUES (${placeholders})`;
}

export interface IdeaInsertRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  description: string | null;
  type: string | null;
  effort: number | null;
  impact: number | null;
  urgency: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  is_priority: boolean;
  priority_order: number | null;
  status: string;
  notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  attempt_dates: string[];
  status_history: { status: string; at: string }[] | null;
  in_focus: boolean;
  in_focus_until: string | null;
  productivity_signal: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Params in IDEA_INSERT_COLUMNS order, with app→DB transforms applied once. */
export function ideaInsertParams(row: IdeaInsertRow): unknown[] {
  return [
    row.id,
    row.user_id,
    row.parent_id,
    row.text,
    row.description,
    row.type,
    row.effort,
    row.impact,
    row.urgency,
    row.scheduled_date,
    row.scheduled_time,
    row.duration_minutes,
    row.is_priority ? 1 : 0,
    row.priority_order,
    row.status,
    row.notes,
    row.completed_at,
    row.cancelled_at,
    row.paused_at,
    JSON.stringify(row.attempt_dates),
    row.status_history ? JSON.stringify(row.status_history) : null,
    row.in_focus ? 1 : 0,
    row.in_focus_until,
    row.productivity_signal ?? null,
    row.sort_order,
    row.created_at,
    row.updated_at,
  ];
}
