"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@powersync/react";
import {
  deserializePathItem,
  deserializePathEdge,
  type PathItem,
  type PathEdge,
} from "@/lib/paths";

export interface PathGraphData {
  items: PathItem[];
  edges: PathEdge[];
  promotedStatuses: Record<string, string>; // idea_id -> status
  loading: boolean;
}

export function usePathGraphData(pathId: string): PathGraphData {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const hasScope = Boolean(userId && pathId);

  const { data: rawItems, isLoading: itemsLoading } = useQuery<Record<string, unknown>>(
    hasScope ? "SELECT * FROM path_items WHERE path_id = ?" : "SELECT * FROM path_items WHERE 0",
    hasScope ? [pathId] : [],
  );

  const { data: rawEdges, isLoading: edgesLoading } = useQuery<Record<string, unknown>>(
    hasScope ? "SELECT * FROM path_edges WHERE path_id = ?" : "SELECT * FROM path_edges WHERE 0",
    hasScope ? [pathId] : [],
  );

  const items: PathItem[] = useMemo(() => rawItems.map(deserializePathItem), [rawItems]);
  const edges: PathEdge[] = useMemo(() => rawEdges.map(deserializePathEdge), [rawEdges]);

  // Query statuses of promoted ideas
  const promotedIdeaIds = useMemo(
    () => items.map((i) => i.idea_id).filter((id): id is string => Boolean(id)),
    [items],
  );

  const { data: rawIdeaStatuses } = useQuery<Record<string, unknown>>(
    hasScope && promotedIdeaIds.length > 0
      ? `SELECT id, status FROM ideas WHERE id IN (${promotedIdeaIds.map(() => "?").join(",")})`
      : "SELECT * FROM ideas WHERE 0",
    hasScope && promotedIdeaIds.length > 0 ? promotedIdeaIds : [],
  );

  const promotedStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rawIdeaStatuses) {
      if (row.id) map[String(row.id)] = String(row.status ?? "open");
    }
    return map;
  }, [rawIdeaStatuses]);

  return {
    items,
    edges,
    promotedStatuses,
    loading: itemsLoading || edgesLoading,
  };
}
