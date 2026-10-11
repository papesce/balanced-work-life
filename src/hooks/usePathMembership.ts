"use client";

import { useMemo } from "react";
import { useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { buildPathMembership, type PathMembershipRow } from "@/lib/paths";

/**
 * Project-wide path membership: task id → sorted path titles.
 * Single JOIN query so the List view can chip every row without
 * one query per path.
 */
export function usePathMembership(projectId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const hasScope = Boolean(userId && projectId);
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    hasScope
      ? `SELECT pi.idea_id AS idea_id, pi.path_id AS path_id, p.title AS title
         FROM path_items pi JOIN paths p ON p.id = pi.path_id
         WHERE p.project_id = ? AND p.user_id = ?`
      : "SELECT * FROM path_items WHERE 0",
    hasScope ? [projectId, userId] : [],
  );

  const titlesByIdea = useMemo(() => {
    const rows: PathMembershipRow[] = rawRows.map((r) => ({
      idea_id: typeof r.idea_id === "string" ? r.idea_id : "",
      path_id: typeof r.path_id === "string" ? r.path_id : "",
      title: typeof r.title === "string" ? r.title : "",
    }));
    return buildPathMembership(rows);
  }, [rawRows]);

  return { titlesByIdea, loading: isLoading };
}
