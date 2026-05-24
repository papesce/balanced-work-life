"use client";

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import { IdeaLink, LinkType } from "@/lib/types";

export function useIdeaLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<IdeaLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("idea_links")
      .select("*")
      .eq("user_id", user.id);
    if (data) setLinks(data as IdeaLink[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createLink = async (
    sourceId: string,
    targetId: string,
    linkType: LinkType
  ): Promise<string> => {
    if (!user) return "";
    const id = uuidv4();
    const now = new Date().toISOString();
    const link: IdeaLink = {
      id,
      user_id: user.id,
      source_id: sourceId,
      target_id: targetId,
      link_type: linkType,
      created_at: now,
    };
    setLinks((prev) => [...prev, link]);
    await supabase.from("idea_links").insert(link);
    return id;
  };

  const deleteLink = async (id: string): Promise<void> => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("idea_links").delete().eq("id", id);
  };

  const getLinksForIdea = useCallback(
    (ideaId: string): IdeaLink[] => {
      return links.filter(
        (l) => l.source_id === ideaId || l.target_id === ideaId
      );
    },
    [links]
  );

  return {
    links,
    loading,
    createLink,
    deleteLink,
    getLinksForIdea,
    refetch: fetchLinks,
  };
}
