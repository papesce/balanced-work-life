"use client";

import { User } from "@supabase/supabase-js";
import type { AbstractPowerSyncDatabase } from "@powersync/web";
import {
  ClassificationOption,
  ClassificationScheme,
  Idea,
  IdeaClassification,
  IdeaLink,
  QuickNote,
  Tag,
  TaskTag,
} from "@/lib/types";
import {
  STORAGE_KEYS,
  SecondaryLensMap,
  readRawString,
  readSecondaryLensMap,
  writeRawString,
  writeSecondaryLensMap,
} from "@/lib/storage";

export interface BackupTaskTag extends TaskTag {
  id: string;
}

export interface BackupLensPrefs {
  horizonLens: string | null;
  projectsLens: string | null;
  horizonSecondaryMap: SecondaryLensMap;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  ideas: Idea[];
  ideaLinks: IdeaLink[];
  tags: Tag[];
  taskTags: BackupTaskTag[];
  quickNotes: QuickNote[];
  classificationSchemes: ClassificationScheme[];
  classificationOptions: ClassificationOption[];
  ideaClassifications: IdeaClassification[];
  lensPrefs: BackupLensPrefs | null;
}

export const BACKUP_VERSION = 3;

export function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.ideas) && Array.isArray(obj.ideaLinks);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Accepts v1 backups (no tags/taskTags) and v2 backups (no
 * quickNotes/classifications/lensPrefs) by defaulting new fields to empty.
 */
export function normalizeBackup(data: BackupData): BackupData {
  const obj = data as unknown as Record<string, unknown>;
  return {
    ...data,
    version: typeof obj.version === "number" ? obj.version : 1,
    tags: asArray<Tag>(obj.tags),
    taskTags: asArray<BackupTaskTag>(obj.taskTags),
    quickNotes: asArray<QuickNote>(obj.quickNotes),
    classificationSchemes: asArray<ClassificationScheme>(obj.classificationSchemes),
    classificationOptions: asArray<ClassificationOption>(obj.classificationOptions),
    ideaClassifications: asArray<IdeaClassification>(obj.ideaClassifications),
    lensPrefs:
      obj.lensPrefs && typeof obj.lensPrefs === "object"
        ? (obj.lensPrefs as BackupLensPrefs)
        : null,
  };
}

export function readLensPrefsForBackup(): BackupLensPrefs {
  return {
    horizonLens: readRawString(STORAGE_KEYS.horizonLens),
    projectsLens: readRawString(STORAGE_KEYS.projectsLens),
    horizonSecondaryMap: readSecondaryLensMap(STORAGE_KEYS.horizonSecondaryMap),
  };
}

export async function buildBackupData(
  user: User,
  db: AbstractPowerSyncDatabase,
): Promise<BackupData> {
  const [
    rawIdeas,
    rawLinks,
    rawTags,
    rawTaskTags,
    rawQuickNotes,
    rawSchemes,
    rawOptions,
    rawClassifications,
  ] = await Promise.all([
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
    db.getAll<QuickNote>("SELECT * FROM quick_notes WHERE user_id = ?", [user.id]),
    db.getAll<ClassificationScheme>("SELECT * FROM classification_schemes WHERE user_id = ?", [
      user.id,
    ]),
    db.getAll<ClassificationOption>(
      `SELECT o.* FROM classification_options o
       JOIN classification_schemes s ON s.id = o.scheme_id
       WHERE s.user_id = ?`,
      [user.id],
    ),
    db.getAll<IdeaClassification>("SELECT * FROM idea_classifications WHERE user_id = ?", [
      user.id,
    ]),
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
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ideas,
    ideaLinks: rawLinks,
    tags,
    taskTags: rawTaskTags,
    quickNotes: rawQuickNotes,
    classificationSchemes: rawSchemes,
    classificationOptions: rawOptions,
    ideaClassifications: rawClassifications,
    lensPrefs: readLensPrefsForBackup(),
  };
}

/**
 * Additive merge restore (INSERT OR REPLACE, never deletes). Parent-first
 * order matters: schemes -> options -> classifications, so FK/RLS checks see
 * the parent row. The client's dedupe pass in useClassifications heals any
 * duplicate scheme keys that collide with locally-seeded rows.
 */
export async function restoreClassifications(
  db: AbstractPowerSyncDatabase,
  schemes: ClassificationScheme[],
  options: ClassificationOption[],
  classifications: IdeaClassification[],
): Promise<void> {
  if (schemes.length === 0 && options.length === 0 && classifications.length === 0) return;
  await db.writeTransaction(async (tx) => {
    for (const s of schemes) {
      await tx.execute(
        `INSERT OR REPLACE INTO classification_schemes (id, user_id, key, label, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
        [s.id, s.user_id, s.key, s.label, s.sort_order, s.created_at],
      );
    }
    for (const o of options) {
      await tx.execute(
        `INSERT OR REPLACE INTO classification_options (id, scheme_id, value, label, sort_order, created_at) VALUES (?,?,?,?,?,?)`,
        [o.id, o.scheme_id, o.value, o.label, o.sort_order, o.created_at],
      );
    }
    for (const c of classifications) {
      await tx.execute(
        `INSERT OR REPLACE INTO idea_classifications (id, idea_id, scheme_id, option_id, user_id, created_at) VALUES (?,?,?,?,?,?)`,
        [c.id, c.idea_id, c.scheme_id, c.option_id, c.user_id, c.created_at],
      );
    }
  });
}

/** Additive merge restore for quick notes; preserves status/archived/deleted timestamps. */
export async function restoreQuickNotes(
  db: AbstractPowerSyncDatabase,
  notes: QuickNote[],
): Promise<void> {
  if (notes.length === 0) return;
  await db.writeTransaction(async (tx) => {
    for (const n of notes) {
      await tx.execute(
        `INSERT OR REPLACE INTO quick_notes (id, user_id, text, status, created_at, updated_at, archived_at, deleted_at) VALUES (?,?,?,?,?,?,?,?)`,
        [
          n.id,
          n.user_id,
          n.text,
          n.status,
          n.created_at,
          n.updated_at,
          n.archived_at ?? null,
          n.deleted_at ?? null,
        ],
      );
    }
  });
}

/**
 * Restore lens view prefs only onto empty local keys — never overwrite an
 * active device's view config. Returns the keys that were restored.
 */
export function restoreLensPrefsIfEmpty(prefs: BackupLensPrefs | null): string[] {
  if (!prefs) return [];
  const restored: string[] = [];
  if (prefs.horizonLens && !readRawString(STORAGE_KEYS.horizonLens)) {
    writeRawString(STORAGE_KEYS.horizonLens, prefs.horizonLens);
    restored.push(STORAGE_KEYS.horizonLens);
  }
  if (prefs.projectsLens && !readRawString(STORAGE_KEYS.projectsLens)) {
    writeRawString(STORAGE_KEYS.projectsLens, prefs.projectsLens);
    restored.push(STORAGE_KEYS.projectsLens);
  }
  const hasSecondary =
    prefs.horizonSecondaryMap && Object.keys(prefs.horizonSecondaryMap).length > 0;
  if (
    hasSecondary &&
    Object.keys(readSecondaryLensMap(STORAGE_KEYS.horizonSecondaryMap)).length === 0
  ) {
    writeSecondaryLensMap(STORAGE_KEYS.horizonSecondaryMap, prefs.horizonSecondaryMap);
    restored.push(STORAGE_KEYS.horizonSecondaryMap);
  }
  return restored;
}

export function downloadBackup(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `balanced-work-life-${new Date().toISOString().slice(0, 10)}.json`;
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
