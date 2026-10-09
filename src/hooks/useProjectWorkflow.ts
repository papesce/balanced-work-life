"use client";

import { useCallback, useMemo } from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { EMPTY_WORKFLOW, parseWorkflow, type ProjectWorkflow } from "@/lib/projectWorkflow";

export function useProjectWorkflow(projectId: string) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const { data, isLoading } = useQuery<{ document: unknown }>(
    userId
      ? "SELECT document FROM project_workflows WHERE project_id = ? AND user_id = ?"
      : "SELECT document FROM project_workflows WHERE 0",
    userId ? [projectId, userId] : [],
  );
  const workflow = useMemo(() => parseWorkflow(data[0]?.document), [data]);
  const save = useCallback(
    async (next: ProjectWorkflow) => {
      if (!userId) return;
      const now = new Date().toISOString();
      // No true UPSERT here: synced tables are exposed locally as views and
      // SQLite cannot plan `ON CONFLICT ... DO UPDATE` against a view
      // ("cannot UPSERT a view"). UPDATE first, INSERT OR IGNORE when new.
      const updated = await db.execute(
        `UPDATE project_workflows SET user_id = ?, document = ?, updated_at = ? WHERE id = ?`,
        [userId, JSON.stringify(next), now, projectId],
      );
      if (updated.rowsAffected === 0) {
        await db.execute(
          `INSERT OR IGNORE INTO project_workflows (id, user_id, project_id, document, updated_at) VALUES (?,?,?,?,?)`,
          [projectId, userId, projectId, JSON.stringify(next), now],
        );
      }
    },
    [db, projectId, userId],
  );
  return { workflow: workflow ?? EMPTY_WORKFLOW, loading: isLoading, save };
}
