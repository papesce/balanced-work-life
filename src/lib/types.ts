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

export type IdeaType = "idea" | "objective" | "project" | "initiative" | "task";
export type LifeArea = "work" | "health" | "relationships" | "growth" | "finances" | "life";

export interface Idea {
  id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  type: IdeaType | null;
  area: LifeArea | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IdeaNode extends Idea {
  children: IdeaNode[];
  collapsed: boolean;
}
