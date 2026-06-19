export type IdeaType = "idea" | "objective" | "project" | "initiative" | "task";
export type LifeArea = "work" | "health" | "relationships" | "growth" | "finances" | "life";
export type IdeaStatus = "inbox" | "planned" | "scheduled" | "in_progress" | "paused" | "completed" | "cancelled" | "archived";

export interface Idea {
  id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  type: IdeaType | null;
  area: LifeArea | null;
  effort: number | null;
  impact: number | null;
  urgency: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  is_priority: boolean;
  priority_order: number | null;
  status: IdeaStatus;
  notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  paused_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type LinkType = "unblocks" | "contributes_to" | "depends_on" | "related_to" | "part_of";

export interface IdeaLink {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  link_type: LinkType;
  created_at: string;
}

export interface IdeaNode extends Idea {
  children: IdeaNode[];
  collapsed: boolean;
}
