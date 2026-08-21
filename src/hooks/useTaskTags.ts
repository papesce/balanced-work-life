"use client";

import { useCallback } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { Tag } from "@/lib/types";

interface TaskTagJoinRow {
  idea_id: string;
  tag_id: string;
  id: string;
  user_id: string;
  name: string;
  area: string;
  is_system: number;
  created_at: string;
}

function buildTagsByIdeaFromRows(rows: TaskTagJoinRow[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const row of rows) {
    const tag: Tag = {
      id: row.tag_id,
      user_id: row.user_id,
      name: row.name,
      area: row.area as Tag["area"],
      is_system: Boolean(row.is_system),
      created_at: row.created_at,
    };
    const existing = map.get(row.idea_id) ?? [];
    map.set(row.idea_id, [...existing, tag]);
  }
  return map;
}

export function useTaskTags() {
  const { user } = useAuth();
  const db = usePowerSync();

  const userId = user?.id ?? "";
  const { data: rawRows, isLoading: loading } = useQuery<TaskTagJoinRow>(
    userId
      ? `SELECT tt.idea_id, tt.tag_id,
               t.id, t.user_id, t.name, t.area, t.is_system, t.created_at
         FROM task_tags tt
         JOIN tags t ON t.id = tt.tag_id
         WHERE t.user_id = ?`
      : "SELECT tt.idea_id FROM task_tags tt WHERE 0",
    userId ? [userId] : [],
  );

  const tagsByIdea: Map<string, Tag[]> = buildTagsByIdeaFromRows(rawRows as TaskTagJoinRow[]);

  const getTagsForIdea = useCallback(
    (ideaId: string): Tag[] => {
      return tagsByIdea.get(ideaId) ?? [];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRows],
  );

  const addTagToTask = async (ideaId: string, tag: Tag) => {
    await db.execute(`INSERT OR IGNORE INTO task_tags (id, idea_id, tag_id) VALUES (?,?,?)`, [
      `${ideaId}:${tag.id}`,
      ideaId,
      tag.id,
    ]);
  };

  const removeTagFromTask = async (ideaId: string, tagId: string) => {
    await db.execute(`DELETE FROM task_tags WHERE idea_id = ? AND tag_id = ?`, [ideaId, tagId]);
  };

  const refetch = useCallback(async () => {
    // useQuery is live — no manual refetch needed; kept for API compatibility
  }, []);

  return {
    tagsByIdea,
    loading,
    getTagsForIdea,
    addTagToTask,
    removeTagFromTask,
    refetch,
  };
}
