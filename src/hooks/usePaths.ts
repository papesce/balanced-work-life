"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import { deserializePath, nextPathSortOrder, sortPaths, type Path } from "@/lib/paths";

export function usePaths(projectId: string) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  const hasScope = Boolean(userId && projectId);
  const { data: rawRows, isLoading } = useQuery<Record<string, unknown>>(
    hasScope
      ? "SELECT * FROM paths WHERE project_id = ? AND user_id = ? ORDER BY sort_order ASC"
      : "SELECT * FROM paths WHERE 0",
    hasScope ? [projectId, userId] : [],
  );

  const paths: Path[] = useMemo(() => sortPaths(rawRows.map(deserializePath)), [rawRows]);

  const createPath = async (title?: string): Promise<string | null> => {
    if (!user || !projectId) return null;
    const now = new Date().toISOString();
    const id = uuidv4();
    const name = (title ?? "").trim() || "New path";
    await db.execute(
      `INSERT INTO paths (id, user_id, project_id, title, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
      [id, user.id, projectId, name, nextPathSortOrder(paths), now, now],
    );
    return id;
  };

  const renamePath = async (id: string, title: string): Promise<void> => {
    const now = new Date().toISOString();
    await db.execute(`UPDATE paths SET title = ?, updated_at = ? WHERE id = ?`, [title, now, id]);
  };

  /**
   * Deletes the path and its items only. Tasks (ideas) and links
   * (idea_links) are never touched.
   */
  const deletePath = async (id: string): Promise<void> => {
    await db.writeTransaction(async (tx) => {
      await tx.execute(`DELETE FROM path_items WHERE path_id = ?`, [id]);
      await tx.execute(`DELETE FROM paths WHERE id = ?`, [id]);
    });
  };

  return { paths, loading: isLoading, createPath, renamePath, deletePath };
}
