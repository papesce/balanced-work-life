import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { Idea, LifeArea, Tag, getAreasForIdea } from "./types";

interface TaskTagJoinRow {
  idea_id: string;
  tag_id: string;
  user_id: string;
  name: string;
  area: string;
  is_system: number;
}

export type RangedTask = Pick<Idea, "id" | "scheduled_date" | "type" | "status">;

export function emptyAreaCounts(): Record<LifeArea, number> {
  return { work: 0, health: 0, relationships: 0, growth: 0, finances: 0, life: 0 };
}

export function getEffectiveAreasForIdea(tags: Tag[]): LifeArea[] {
  const areas = getAreasForIdea(tags);
  return areas.length > 0 ? areas : ["life"];
}

export function buildTagsByIdeaMap(rows: TaskTagJoinRow[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const row of rows) {
    const tag: Tag = {
      id: row.tag_id,
      user_id: row.user_id,
      name: row.name,
      area: row.area as LifeArea,
      is_system: Boolean(row.is_system),
      created_at: "",
    };
    const existing = map.get(row.idea_id) ?? [];
    map.set(row.idea_id, [...existing, tag]);
  }
  return map;
}

export async function fetchTagsByIdea(
  db: AbstractPowerSyncDatabase,
  userId: string,
  ideaIds?: string[],
): Promise<Map<string, Tag[]>> {
  if (ideaIds && ideaIds.length === 0) return new Map();

  let sql = `SELECT tt.idea_id, tt.tag_id,
                    t.user_id, t.name, t.area, t.is_system
             FROM task_tags tt
             JOIN tags t ON t.id = tt.tag_id
             WHERE t.user_id = ?`;
  const params: unknown[] = [userId];

  if (ideaIds && ideaIds.length > 0) {
    sql += ` AND tt.idea_id IN (${ideaIds.map(() => "?").join(",")})`;
    params.push(...ideaIds);
  }

  const rows = await db.getAll<TaskTagJoinRow>(sql, params);
  return buildTagsByIdeaMap(rows);
}

export interface TasksWithTags {
  tasks: RangedTask[];
  tagsByIdea: Map<string, Tag[]>;
}

export async function fetchTasksWithTags(
  db: AbstractPowerSyncDatabase,
  userId: string,
  options: { start?: string; end?: string; select?: string } = {},
): Promise<TasksWithTags> {
  const { start, end } = options;

  let sql = `SELECT id, scheduled_date, type, status FROM ideas WHERE user_id = ? AND type = 'task'`;
  const params: unknown[] = [userId];

  if (start) {
    sql += " AND scheduled_date >= ?";
    params.push(start);
  }
  if (end) {
    sql += " AND scheduled_date <= ?";
    params.push(end);
  }

  const tasks = await db.getAll<RangedTask>(sql, params);
  return {
    tasks,
    tagsByIdea: await fetchTagsByIdea(
      db,
      userId,
      tasks.map((t: RangedTask) => t.id),
    ),
  };
}
