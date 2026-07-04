"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Tag, TaskTag } from "@/lib/types";

interface TaskTagRow extends TaskTag {
  tags: Tag;
}

export function useTaskTags() {
  const { user } = useAuth();
  // Map from idea_id → Tag[]
  const [tagsByIdea, setTagsByIdea] = useState<Map<string, Tag[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchTaskTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("task_tags")
      .select("idea_id, tag_id, tags(*)")
      .eq("tags.user_id", user.id);
    if (data) setTagsByIdea(buildMap(data as unknown as TaskTagRow[]));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("task_tags")
        .select("idea_id, tag_id, tags(*)")
        .eq("tags.user_id", user.id);
      if (cancelled) return;
      if (data) setTagsByIdea(buildMap(data as unknown as TaskTagRow[]));
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [user]);

  const getTagsForIdea = useCallback((ideaId: string): Tag[] => {
    return tagsByIdea.get(ideaId) ?? [];
  }, [tagsByIdea]);

  const addTagToTask = async (ideaId: string, tag: Tag) => {
    setTagsByIdea((prev) => {
      const next = new Map(prev);
      const current = next.get(ideaId) ?? [];
      if (current.some((t) => t.id === tag.id)) return prev;
      next.set(ideaId, [...current, tag]);
      return next;
    });
    const { error } = await supabase
      .from("task_tags")
      .insert({ idea_id: ideaId, tag_id: tag.id });
    if (error) {
      setTagsByIdea((prev) => {
        const next = new Map(prev);
        const current = next.get(ideaId) ?? [];
        next.set(ideaId, current.filter((t) => t.id !== tag.id));
        return next;
      });
      console.error("Failed to add tag to task", error);
      throw error;
    }
  };

  const removeTagFromTask = async (ideaId: string, tagId: string) => {
    const previous = tagsByIdea.get(ideaId);
    setTagsByIdea((prev) => {
      const next = new Map(prev);
      next.set(ideaId, (next.get(ideaId) ?? []).filter((t) => t.id !== tagId));
      return next;
    });
    const { error } = await supabase
      .from("task_tags")
      .delete()
      .eq("idea_id", ideaId)
      .eq("tag_id", tagId);
    if (error) {
      if (previous) setTagsByIdea((prev) => new Map(prev).set(ideaId, previous));
      console.error("Failed to remove tag from task", error);
      throw error;
    }
  };

  return { tagsByIdea, loading, getTagsForIdea, addTagToTask, removeTagFromTask, refetch: fetchTaskTags };
}

function buildMap(rows: TaskTagRow[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const row of rows) {
    if (!row.tags) continue;
    const existing = map.get(row.idea_id) ?? [];
    map.set(row.idea_id, [...existing, row.tags]);
  }
  return map;
}
