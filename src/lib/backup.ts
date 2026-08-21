"use client";

import { User } from "@supabase/supabase-js";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import { Idea, IdeaLink, Tag, TaskTag } from "@/lib/types";

export interface BackupTaskTag extends TaskTag {
  id: string;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  ideas: Idea[];
  ideaLinks: IdeaLink[];
  tags: Tag[];
  taskTags: BackupTaskTag[];
}

export function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.ideas) && Array.isArray(obj.ideaLinks);
}

/** Accepts v1 backups (no tags/taskTags) by defaulting the new fields to empty arrays. */
export function normalizeBackup(data: BackupData): BackupData {
  return {
    ...data,
    version: data.version ?? 1,
    tags: Array.isArray(data.tags) ? data.tags : [],
    taskTags: Array.isArray(data.taskTags) ? data.taskTags : [],
  };
}

export async function buildBackupData(
  user: User,
  db: AbstractPowerSyncDatabase,
): Promise<BackupData> {
  const [rawIdeas, rawLinks, rawTags, rawTaskTags] = await Promise.all([
    db.getAll<Record<string, unknown>>("SELECT * FROM ideas WHERE user_id = ?", [user.id]),
    db.getAll<IdeaLink>("SELECT * FROM idea_links WHERE user_id = ?", [user.id]),
    db.getAll<Record<string, unknown>>("SELECT * FROM tags WHERE user_id = ?", [user.id]),
    db.getAll<BackupTaskTag>(
      `SELECT tt.id, tt.idea_id, tt.tag_id
       FROM task_tags tt
       JOIN tags t ON t.id = tt.tag_id
       WHERE t.user_id = ?`,
      [user.id],
    ),
  ]);

  // Deserialize JSON text columns stored by PowerSync
  const ideas: Idea[] = rawIdeas.map(
    (row: Record<string, unknown>) =>
      ({
        ...row,
        is_priority: Boolean(row.is_priority),
        attempt_dates: row.attempt_dates
          ? (JSON.parse(row.attempt_dates as string) as string[])
          : [],
        status_history: row.status_history
          ? (JSON.parse(row.status_history as string) as Idea["status_history"])
          : null,
      }) as unknown as Idea,
  );

  const tags: Tag[] = rawTags.map((row: Record<string, unknown>) => ({
    ...(row as unknown as Tag),
    is_system: Boolean(row.is_system),
  }));

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    ideas,
    ideaLinks: rawLinks,
    tags,
    taskTags: rawTaskTags,
  };
}

export function downloadBackup(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();
  const data: unknown = JSON.parse(text);

  if (!isValidBackup(data)) {
    throw new Error("Invalid backup file. Expected JSON with 'ideas' and 'ideaLinks' arrays.");
  }

  return normalizeBackup(data);
}
