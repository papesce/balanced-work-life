"use client";

import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Idea, IdeaLink } from "@/lib/types";

export interface BackupData {
  version: number;
  exportedAt: string;
  ideas: Idea[];
  ideaLinks: IdeaLink[];
}

export function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.ideas) && Array.isArray(obj.ideaLinks);
}

export async function buildBackupData(user: User): Promise<BackupData> {
  const [ideasRes, linksRes] = await Promise.all([
    supabase.from("ideas").select("*").eq("user_id", user.id),
    supabase.from("idea_links").select("*").eq("user_id", user.id),
  ]);

  if (ideasRes.error) throw ideasRes.error;
  if (linksRes.error) throw linksRes.error;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ideas: ideasRes.data as Idea[],
    ideaLinks: linksRes.data as IdeaLink[],
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

  return data;
}
