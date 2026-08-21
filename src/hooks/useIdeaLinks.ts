"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { IdeaLink, LinkType } from "@/lib/types";

export function useIdeaLinks() {
  const { user } = useAuth();
  const db = usePowerSync();

  const userId = user?.id ?? "";
  const { data: links, isLoading: loading } = useQuery<IdeaLink>(
    userId ? "SELECT * FROM idea_links WHERE user_id = ?" : "SELECT * FROM idea_links WHERE 0",
    userId ? [userId] : [],
  );

  const createLink = async (
    sourceId: string,
    targetId: string,
    linkType: LinkType,
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
    await db.execute(
      `INSERT INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)`,
      [link.id, link.user_id, link.source_id, link.target_id, link.link_type, link.created_at],
    );
    return id;
  };

  const deleteLink = async (id: string): Promise<void> => {
    await db.execute(`DELETE FROM idea_links WHERE id = ?`, [id]);
  };

  const removeLinksForIdeaIds = (ideaIds: Set<string>): IdeaLink[] => {
    const removed = links.filter(
      (link) => ideaIds.has(link.source_id) || ideaIds.has(link.target_id),
    );
    // Fire-and-forget deletes
    for (const link of removed) {
      void db.execute(`DELETE FROM idea_links WHERE id = ?`, [link.id]);
    }
    return removed;
  };

  const restoreLinks = async (restoredLinks: IdeaLink[]): Promise<void> => {
    if (restoredLinks.length === 0) return;
    for (const link of restoredLinks) {
      await db.execute(
        `INSERT OR REPLACE INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)`,
        [link.id, link.user_id, link.source_id, link.target_id, link.link_type, link.created_at],
      );
    }
  };

  const getLinksForIdea = useCallback(
    (ideaId: string): IdeaLink[] => {
      return links.filter((l) => l.source_id === ideaId || l.target_id === ideaId);
    },
    [links],
  );

  const refetch = useCallback(async () => {
    // useQuery is live — no manual refetch needed; kept for API compatibility
  }, []);

  return {
    links,
    loading,
    createLink,
    deleteLink,
    removeLinksForIdeaIds,
    restoreLinks,
    getLinksForIdea,
    refetch,
  };
}
