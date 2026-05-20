export type TimeBucket = "today" | "tomorrow" | "next_week" | "backlog";
export type BalanceCategory = "work" | "life";
export type TaskStatus = "active" | "done";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  time_bucket: TimeBucket;
  balance_category: BalanceCategory;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}
