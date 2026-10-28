"use client";

import { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePowerSync, useQuery } from "@powersync/react";
import { useAuth } from "./useAuth";
import {
  deserializePathItem,
  deserializePathEdge,
  type PathItem,
  type PathEdge,
  type PathPosition,
} from "@/lib/paths";

export function usePathManager(pathId: string) {
  const { user } = useAuth();
  const db = usePowerSync();
  const userId = user?.id ?? "";

  const hasScope = Boolean(userId && pathId);

  // 1. Data Fetching
  const { data: rawItems, isLoading: itemsLoading } = useQuery<Record<string, unknown>>(
    hasScope
      ? `SELECT pi.*, i.text AS idea_text, i.status AS idea_status
         FROM path_items pi
         LEFT JOIN ideas i ON i.id = pi.idea_id
         WHERE pi.path_id = ? AND pi.user_id = ?`
      : "SELECT * FROM path_items WHERE 0",
    hasScope ? [pathId, userId] : [],
  );
  const { data: rawEdges, isLoading: edgesLoading } = useQuery<Record<string, unknown>>(
    hasScope ? "SELECT * FROM path_edges WHERE path_id = ?" : "SELECT * FROM path_edges WHERE 0",
    hasScope ? [pathId] : [],
  );

  const items: PathItem[] = useMemo(() => rawItems.map(deserializePathItem), [rawItems]);
  const edges: PathEdge[] = useMemo(() => rawEdges.map(deserializePathEdge), [rawEdges]);

  // 2. Node Management
  const addNode = async (title: string, x = 0, y = 0): Promise<string> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO path_items (id, user_id, path_id, title, idea_id, x, y, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [id, userId, pathId, title, null, x, y, now],
    );
    return id;
  };

  const addExistingIdea = async (
    ideaId: string,
    x = 100 + (items.length % 3) * 220,
    y = 100 + Math.floor(items.length / 3) * 140,
  ): Promise<string> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");

    return db.writeTransaction(async (tx) => {
      const path = await tx.getOptional<Record<string, unknown>>(
        "SELECT id FROM ideas WHERE id = ? AND user_id = ? AND type = 'path'",
        [pathId, userId],
      );
      if (!path) throw new Error("This path is unavailable.");

      const existing = await tx.getOptional<Record<string, unknown>>(
        "SELECT id FROM path_items WHERE path_id = ? AND user_id = ? AND idea_id = ?",
        [pathId, userId, ideaId],
      );
      if (existing) return String(existing.id);

      const idea = await tx.getOptional<Record<string, unknown>>(
        "SELECT text, type FROM ideas WHERE id = ? AND user_id = ?",
        [ideaId, userId],
      );
      if (!idea || idea.type === "path") {
        throw new Error("This idea is unavailable or cannot be added to a path.");
      }

      const itemId = uuidv4();
      await tx.execute(
        `INSERT OR IGNORE INTO path_items (id, user_id, path_id, title, idea_id, x, y, created_at) VALUES (?,?,?,?,?,?,?,?)`,
        [itemId, userId, pathId, String(idea.text ?? ""), ideaId, x, y, new Date().toISOString()],
      );
      const inserted = await tx.getOptional<Record<string, unknown>>(
        "SELECT id FROM path_items WHERE path_id = ? AND user_id = ? AND idea_id = ?",
        [pathId, userId, ideaId],
      );
      if (!inserted) throw new Error("The idea could not be added to this path.");
      return String(inserted.id);
    });
  };

  const updateNodeTitle = async (itemId: string, title: string): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    await db.execute(
      "UPDATE path_items SET title = ? WHERE id = ? AND path_id = ? AND user_id = ?",
      [title, itemId, pathId, userId],
    );
  };

  const updateNodeNotes = async (itemId: string, notes: string | null): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    await db.execute(
      "UPDATE path_items SET notes = ? WHERE id = ? AND path_id = ? AND user_id = ?",
      [notes?.trim() || null, itemId, pathId, userId],
    );
  };

  const linkNodeToTask = async (itemId: string, taskId: string): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");

    await db.writeTransaction(async (tx) => {
      const pathProject = await tx.getOptional<Record<string, unknown>>(
        `SELECT l.target_id AS project_id
         FROM idea_links l
         JOIN ideas p ON p.id = l.target_id AND p.user_id = l.user_id
         WHERE l.source_id = ? AND l.user_id = ? AND l.link_type = 'path_of' AND p.type = 'project'
         LIMIT 1`,
        [pathId, userId],
      );
      if (!pathProject) throw new Error("This path is not linked to a project.");

      const task = await tx.getOptional<Record<string, unknown>>(
        `WITH RECURSIVE project_tasks(id) AS (
           SELECT id FROM ideas WHERE parent_id = ? AND user_id = ?
           UNION ALL
           SELECT child.id FROM ideas child
           JOIN project_tasks parent ON child.parent_id = parent.id
           WHERE child.user_id = ?
         )
         SELECT id, text FROM ideas
         WHERE id = ? AND user_id = ? AND type = 'task'
           AND id IN (SELECT id FROM project_tasks)`,
        [String(pathProject.project_id), userId, userId, taskId, userId],
      );
      if (!task) throw new Error("Choose a task that belongs to this project.");

      const item = await tx.getOptional<Record<string, unknown>>(
        "SELECT id FROM path_items WHERE id = ? AND path_id = ? AND user_id = ?",
        [itemId, pathId, userId],
      );
      if (!item) throw new Error("Path step not found.");

      await tx.execute(
        "UPDATE path_items SET idea_id = ?, title = ?, completed_at = NULL, promoted_at = NULL WHERE id = ? AND path_id = ? AND user_id = ?",
        [taskId, String(task.text ?? ""), itemId, pathId, userId],
      );
    });
  };

  const unlinkNodeTask = async (itemId: string): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    await db.execute(
      "UPDATE path_items SET idea_id = NULL, completed_at = NULL, promoted_at = NULL WHERE id = ? AND path_id = ? AND user_id = ?",
      [itemId, pathId, userId],
    );
  };

  const updatePlanStepCompletion = async (itemId: string, completed: boolean): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    await db.execute(
      "UPDATE path_items SET completed_at = ? WHERE id = ? AND path_id = ? AND user_id = ? AND idea_id IS NULL",
      [completed ? new Date().toISOString() : null, itemId, pathId, userId],
    );
  };

  const moveNodes = async (positions: PathPosition[]): Promise<void> => {
    if (positions.length === 0) return;
    await db.writeTransaction(async (tx) => {
      for (const pos of positions) {
        await tx.execute(`UPDATE path_items SET x = ?, y = ? WHERE id = ?`, [
          pos.x,
          pos.y,
          pos.itemId,
        ]);
      }
    });
  };

  const deleteNode = async (itemId: string): Promise<void> => {
    if (!user || !pathId) return;
    await db.writeTransaction(async (tx) => {
      await tx.execute(`DELETE FROM path_items WHERE id = ?`, [itemId]);
      await tx.execute(`DELETE FROM path_edges WHERE from_item_id = ? OR to_item_id = ?`, [
        itemId,
        itemId,
      ]);
    });
  };

  // 3. Edge Management
  const addEdge = async (fromId: string, toId: string): Promise<void> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");
    const id = uuidv4();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT OR IGNORE INTO path_edges (id, user_id, path_id, from_item_id, to_item_id, created_at) VALUES (?,?,?,?,?,?)`,
      [id, userId, pathId, fromId, toId, now],
    );
  };

  const removeEdge = async (edgeId: string): Promise<void> => {
    if (!user || !pathId) return;
    await db.execute(`DELETE FROM path_edges WHERE id = ?`, [edgeId]);
  };

  // 4. Promotion Pipeline
  const promoteNode = async (itemId: string, taskTitle: string): Promise<string> => {
    if (!user || !pathId) throw new Error("Auth or PathId missing");

    return await db.writeTransaction(async (tx) => {
      const existing = await tx.getOptional<Record<string, unknown>>(
        "SELECT idea_id FROM path_items WHERE id = ? AND path_id = ? AND user_id = ?",
        [itemId, pathId, userId],
      );
      if (!existing) throw new Error("Path node not found");
      if (existing.idea_id) return String(existing.idea_id);
      const taskId = uuidv4();
      const now = new Date().toISOString();
      const project = await tx.getOptional<Record<string, unknown>>(
        `SELECT l.target_id AS project_id
         FROM idea_links l
         JOIN ideas i ON i.id = l.target_id AND i.user_id = l.user_id
         WHERE l.source_id = ? AND l.user_id = ? AND l.link_type = 'path_of' AND i.type = 'project'
         LIMIT 1`,
        [pathId, userId],
      );

      // a. Create the real Idea (Task)
      await tx.execute(
        `INSERT INTO ideas (id, user_id, parent_id, text, type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        [taskId, userId, project?.project_id ?? null, taskTitle, "task", "draft", now, now],
      );

      // b. Link the node to the Idea
      await tx.execute(
        `UPDATE path_items SET idea_id = ?, completed_at = NULL, promoted_at = ? WHERE id = ? AND path_id = ? AND user_id = ?`,
        [taskId, now, itemId, pathId, userId],
      );

      // c. Materialize Edges
      // Find all edges connected to this node
      const connectedEdges = await tx.getAll<Record<string, unknown>>(
        `SELECT * FROM path_edges WHERE path_id = ? AND (from_item_id = ? OR to_item_id = ?)`,
        [pathId, itemId, itemId],
      );

      for (const edge of connectedEdges) {
        const fromId = String(edge.from_item_id);
        const toId = String(edge.to_item_id);

        // We only materialize as idea_links if BOTH ends of the edge are now promoted
        const fromItem = await tx.getOptional<Record<string, unknown>>(
          `SELECT idea_id FROM path_items WHERE id = ?`,
          [fromId],
        );
        const toItem = await tx.getOptional<Record<string, unknown>>(
          `SELECT idea_id FROM path_items WHERE id = ?`,
          [toId],
        );

        if (fromItem?.idea_id && toItem?.idea_id) {
          const linkId = uuidv4();
          await tx.execute(
            `INSERT OR IGNORE INTO idea_links (id, user_id, source_id, target_id, link_type, created_at) VALUES (?,?,?,?,?,?)`,
            [linkId, userId, String(fromItem.idea_id), String(toItem.idea_id), "depends_on", now],
          );
        }
      }

      return taskId;
    });
  };

  return {
    items,
    edges,
    loading: itemsLoading || edgesLoading,
    addNode,
    addExistingIdea,
    updateNodeTitle,
    updateNodeNotes,
    linkNodeToTask,
    unlinkNodeTask,
    updatePlanStepCompletion,
    moveNodes,
    deleteNode,
    addEdge,
    removeEdge,
    promoteNode,
  };
}
