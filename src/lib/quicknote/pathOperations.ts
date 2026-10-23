"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import type { AbstractPowerSyncDatabase } from "@powersync/web";

export interface QuickNotePathOperations {
  convertToPath: (text: string) => Promise<{ pathId: string; nodeCount: number }>;
}

interface PathOpsDeps {
  db: AbstractPowerSyncDatabase;
  userId: string;
}

export function useQuickNotePathOperations({ db, userId }: PathOpsDeps): QuickNotePathOperations {
  const convertToPath = useCallback(
    async (text: string) => {
      if (!userId) throw new Error("User not authenticated");

      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) throw new Error("No text to convert");

      const title = lines[0].replace(/^#+\s*/, "").trim();
      const nodeTexts = lines
        .slice(1)
        .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim())
        .filter(Boolean);

      return await db.writeTransaction(async (tx) => {
        const pathId = uuidv4();
        const now = new Date().toISOString();

        // 1. Create the Path Idea
        await tx.execute(
          `INSERT INTO ideas (id, user_id, text, type, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
          [pathId, userId, title || "Untitled path", "path", "draft", now, now],
        );

        // 2. Create sequential placeholder nodes
        const nodeIds: string[] = [];
        for (const [index, text] of nodeTexts.entries()) {
          const nodeId = uuidv4();
          nodeIds.push(nodeId);
          await tx.execute(
            `INSERT INTO path_items (id, user_id, path_id, title, idea_id, x, y, created_at) VALUES (?,?,?,?,?,?,?,?)`,
            [nodeId, userId, pathId, text, null, 100 + index * 240, 100, now],
          );
        }

        // 3. Create edges for the sequence (i -> i+1)
        for (let i = 0; i < nodeIds.length - 1; i++) {
          const edgeId = uuidv4();
          await tx.execute(
            `INSERT INTO path_edges (id, user_id, path_id, from_item_id, to_item_id, created_at) VALUES (?,?,?,?,?,?,?)`,
            [edgeId, userId, pathId, nodeIds[i], nodeIds[i + 1], now],
          );
        }

        return { pathId, nodeCount: nodeIds.length };
      });
    },
    [db, userId],
  );

  return { convertToPath };
}
