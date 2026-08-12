import { supabase } from "./supabase";
import { Idea, LifeArea, Tag, getAreasForIdea } from "./types";

interface TaskTagRow {
  idea_id: string;
  tag_id: string;
  tags: Tag;
}

export type RangedTask = Pick<Idea, "id" | "scheduled_date" | "type" | "status">;

export function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

export function getEffectiveAreasForIdea(tags: Tag[]): LifeArea[] {
  const areas = getAreasForIdea(tags);
  return areas.length > 0 ? areas : ["life"];
}

export function buildTagsByIdeaMap(rows: TaskTagRow[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const row of rows) {
    if (!row.tags) continue;
    const existing = map.get(row.idea_id) ?? [];
    map.set(row.idea_id, [...existing, row.tags]);
  }
  return map;
}

export async function fetchTagsByIdea(
  userId: string,
  ideaIds?: string[],
): Promise<Map<string, Tag[]>> {
  if (ideaIds && ideaIds.length === 0) return new Map();
  let query = supabase
    .from("task_tags")
    .select("idea_id, tag_id, tags(*)")
    .eq("tags.user_id", userId);
  if (ideaIds && ideaIds.length > 0) query = query.in("idea_id", ideaIds);
  const { data } = await query;
  return buildTagsByIdeaMap((data ?? []) as unknown as TaskTagRow[]);
}

export interface TasksWithTags {
  tasks: RangedTask[];
  tagsByIdea: Map<string, Tag[]>;
}

export async function fetchTasksWithTags(
  userId: string,
  options: { start?: string; end?: string; select?: string } = {},
): Promise<TasksWithTags> {
  const { start, end, select = "id, scheduled_date, type, status" } = options;
  let query = supabase.from("ideas").select(select).eq("user_id", userId).eq("type", "task");
  if (start) query = query.gte("scheduled_date", start);
  if (end) query = query.lte("scheduled_date", end);

  const { data } = await query;
  const tasks = (data ?? []) as unknown as RangedTask[];
  return {
    tasks,
    tagsByIdea: await fetchTagsByIdea(
      userId,
      tasks.map((t) => t.id),
    ),
  };
}
