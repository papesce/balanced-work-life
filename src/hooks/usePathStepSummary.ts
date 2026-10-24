"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@powersync/react";

export interface PathStepSummary {
  totalSteps: number;
  completedSteps: number;
}

export function usePathStepSummary(pathId: string): PathStepSummary {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: rows } = useQuery<Record<string, unknown>>(
    userId && pathId
      ? `SELECT pi.id, pi.idea_id, i.status AS idea_status
         FROM path_items pi
         LEFT JOIN ideas i ON i.id = pi.idea_id
         WHERE pi.user_id = ? AND pi.path_id = ?`
      : "SELECT * FROM path_items WHERE 0",
    userId && pathId ? [userId, pathId] : [],
  );

  return useMemo(() => {
    const totalSteps = rows.length;
    let completedSteps = 0;
    for (const r of rows) {
      if (r.idea_status === "completed") {
        completedSteps++;
      }
    }
    return { totalSteps, completedSteps };
  }, [rows]);
}

export function useAllPathStepSummaries(): Map<string, PathStepSummary> {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: rows } = useQuery<Record<string, unknown>>(
    userId
      ? `SELECT pi.path_id, pi.id, pi.idea_id, i.status AS idea_status
         FROM path_items pi
         LEFT JOIN ideas i ON i.id = pi.idea_id
         WHERE pi.user_id = ?`
      : "SELECT * FROM path_items WHERE 0",
    userId ? [userId] : [],
  );

  return useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const r of rows) {
      const pid = String(r.path_id ?? "");
      if (!pid) continue;
      let entry = map.get(pid);
      if (!entry) {
        entry = { total: 0, completed: 0 };
        map.set(pid, entry);
      }
      entry.total++;
      if (r.idea_status === "completed") {
        entry.completed++;
      }
    }
    const result = new Map<string, PathStepSummary>();
    for (const [pid, entry] of map.entries()) {
      result.set(pid, { totalSteps: entry.total, completedSteps: entry.completed });
    }
    return result;
  }, [rows]);
}
