"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@powersync/react";
import { buildPathMembership, type PathMembershipRow } from "@/lib/paths";

/** Task membership derived from path items and path ideas associated to a project. */
export function usePathMembership(projectId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data } = useQuery<Record<string, unknown>>(
    userId && projectId
      ? `SELECT pi.idea_id, pi.path_id, p.text AS title
         FROM path_items pi
         JOIN ideas p ON p.id = pi.path_id
         JOIN idea_links l ON l.source_id = p.id AND l.link_type = 'path_of'
         WHERE pi.user_id = ? AND l.target_id = ? AND pi.idea_id IS NOT NULL`
      : "SELECT * FROM path_items WHERE 0",
    userId && projectId ? [userId, projectId] : [],
  );
  const titlesByIdea = useMemo(
    () => buildPathMembership(data as unknown as PathMembershipRow[]),
    [data],
  );
  const pathedIds = useMemo(() => new Set(titlesByIdea.keys()), [titlesByIdea]);
  return { titlesByIdea, pathedIds };
}
