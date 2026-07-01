"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { Tag, LifeArea } from "@/lib/types";

export function useTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });
    if (data) setTags(data as Tag[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (cancelled) return;
      if (data) setTags(data as Tag[]);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [user]);

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
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    const { error } = await supabase.from("tags").insert(tag);
    if (error) {
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
      console.error("Failed to create tag", error);
      throw error;
    }
    return tag;
  };

  const deleteTag = async (id: string) => {
    const previous = tags.find((t) => t.id === id);
    setTags((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) {
      if (previous) setTags((prev) => [...prev, previous].sort((a, b) => a.name.localeCompare(b.name)));
      console.error("Failed to delete tag", error);
      throw error;
    }
  };

  return { tags, loading, createTag, deleteTag, refetch: fetchTags };
}
