"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "@/hooks/useAuth";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";
import { deserializePath, nextPathSortOrder, sortPaths } from "@/lib/paths";
import { resolveSelectedPathId } from "@/lib/projectPaths";

export function useProjectPaths(projectId: string) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";
  const projectLastPath = useUiPrefsStore((state) => state.projectLastPath);
  const setPrefs = useUiPrefsStore((state) => state.set);
  const rememberedId = projectLastPath[projectId] ?? null;
  const [pendingPathId, setPendingPathId] = useState<string | null>(null);
  const { data: rawPaths } = useQuery<Record<string, unknown>>(
    userId
      ? `SELECT i.*, l.target_id AS project_id
         FROM ideas i
         JOIN idea_links l ON l.source_id = i.id
         WHERE i.user_id = ? AND i.type = 'path'
           AND l.target_id = ? AND l.link_type = 'path_of'
         ORDER BY i.sort_order, i.created_at`
      : "SELECT * FROM ideas WHERE 0",
    userId ? [userId, projectId] : [],
  );
  const paths = useMemo(() => sortPaths(rawPaths.map(deserializePath)), [rawPaths]);
  const selectedPathId = pendingPathId ?? resolveSelectedPathId(paths, rememberedId, null);

  useEffect(() => {
    if (pendingPathId && paths.some((path) => path.id === pendingPathId)) {
      setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: pendingPathId } });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the transient selection after PowerSync observes the new path
      setPendingPathId(null);
      return;
    }
    if (!pendingPathId && !rememberedId && selectedPathId) {
      setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: selectedPathId } });
    }
  }, [pendingPathId, paths, projectId, projectLastPath, rememberedId, selectedPathId, setPrefs]);

  const selectPath = (pathId: string) => {
    if (!paths.some((path) => path.id === pathId)) return;
    setPendingPathId(null);
    setPrefs({ projectLastPath: { ...projectLastPath, [projectId]: pathId } });
  };

  const createPath = async () => {
    if (!userId) throw new Error("Sign in to create a path.");
    const id = uuidv4();
    const now = new Date().toISOString();
    setPendingPathId(id);
    try {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          "INSERT INTO ideas (id, user_id, text, type, status, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
          [id, userId, "Untitled path", "path", "draft", nextPathSortOrder(paths), now, now],
        );
        await tx.execute(
          "INSERT INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)",
          [uuidv4(), userId, id, projectId, "path_of", now],
        );
      });
    } catch (error) {
      setPendingPathId(null);
      throw error;
    }
  };

  const renamePath = async (pathId: string, title: string) => {
    if (!userId) throw new Error("Sign in to rename a path.");
    await db.execute(
      "UPDATE ideas SET text = ?, updated_at = ? WHERE id = ? AND user_id = ? AND type = 'path'",
      [title.trim() || "Untitled path", new Date().toISOString(), pathId, userId],
    );
  };

  const updatePathStatus = async (pathId: string, status: string) => {
    if (!userId) throw new Error("Sign in to update a path.");
    await db.execute(
      "UPDATE ideas SET status = ?, updated_at = ? WHERE id = ? AND user_id = ? AND type = 'path'",
      [status === "open" ? "draft" : status, new Date().toISOString(), pathId, userId],
    );
  };

  const deletePath = async (pathId: string) => {
    if (!userId) throw new Error("Sign in to delete a path.");
    const deletingSelection = rememberedId === pathId;
    const nextPathId = deletingSelection
      ? (paths.find((path) => path.id !== pathId)?.id ?? null)
      : rememberedId;
    await db.writeTransaction(async (tx) => {
      await tx.execute("DELETE FROM path_edges WHERE path_id = ? AND user_id = ?", [
        pathId,
        userId,
      ]);
      await tx.execute("DELETE FROM path_items WHERE path_id = ? AND user_id = ?", [
        pathId,
        userId,
      ]);
      await tx.execute(
        "DELETE FROM idea_links WHERE user_id = ? AND (source_id = ? OR target_id = ?)",
        [userId, pathId, pathId],
      );
      await tx.execute("DELETE FROM ideas WHERE id = ? AND user_id = ? AND type = 'path'", [
        pathId,
        userId,
      ]);
    });
    if (deletingSelection) {
      setPendingPathId(null);
      const nextSelection = { ...projectLastPath };
      if (nextPathId) nextSelection[projectId] = nextPathId;
      else delete nextSelection[projectId];
      setPrefs({ projectLastPath: nextSelection });
    }
  };

  return {
    paths,
    selectedPathId,
    selectPath,
    createPath,
    renamePath,
    updatePathStatus,
    deletePath,
  };
}
