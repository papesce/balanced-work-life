"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { Tag, LifeArea } from "@/lib/types";

function deserializeTag(row: Record<string, unknown>): Tag {
  return {
    ...row,
    is_system: Boolean(row.is_system),
  } as unknown as Tag;
}

export function useTags() {
  const { user } = useAuth();
  const db = usePowerSync();

  const userId = user?.id ?? "";
  const { data: rawRows, isLoading: loading } = useQuery<Record<string, unknown>>(
    userId
      ? "SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC"
      : "SELECT * FROM tags WHERE 0",
    userId ? [userId] : [],
  );

  const tags: Tag[] = rawRows.map(deserializeTag);

  const createTag = async (name: string, area: LifeArea): Promise<Tag | null> => {
    if (!user) return null;
    const now = new Date().toISOString();
    const tag: Tag = {
      id: uuidv4(),
      user_id: user.id,
      name: name.trim(),
      area,
      is_system: false,
      created_at: now,
    };
    await db.execute(
      `INSERT INTO tags (id, user_id, name, area, is_system, created_at) VALUES (?,?,?,?,?,?)`,
      [tag.id, tag.user_id, tag.name, tag.area, tag.is_system ? 1 : 0, tag.created_at],
    );
    return tag;
  };

  const getOrCreateSystemTag = async (area: LifeArea): Promise<Tag | null> => {
    if (!user) return null;
    const existing = tags.find((t) => t.is_system && t.area === area);
    if (existing) return existing;
    const now = new Date().toISOString();
    const tag: Tag = {
      id: uuidv4(),
      user_id: user.id,
      name: area,
      area,
      is_system: true,
      created_at: now,
    };
    await db.execute(
      `INSERT INTO tags (id, user_id, name, area, is_system, created_at) VALUES (?,?,?,?,?,?)`,
      [tag.id, tag.user_id, tag.name, tag.area, 1, tag.created_at],
    );
    return tag;
  };

  const deleteTag = async (id: string) => {
    await db.execute(`DELETE FROM tags WHERE id = ?`, [id]);
  };

  const refetch = useCallback(async () => {
    // useQuery is live — no manual refetch needed; kept for API compatibility
  }, []);

  return { tags, loading, createTag, getOrCreateSystemTag, deleteTag, refetch };
}
