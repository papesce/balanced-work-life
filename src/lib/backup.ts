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
import type { SecondaryLensMap } from "@/lib/storage";
import { parseSecondaryMapText, sanitizeView, horizonPrefsId } from "@/lib/horizonViews";
import { useUiPrefsStore } from "@/stores/uiPrefsStore";

export interface BackupTaskTag extends TaskTag {
  id: string;
}

export interface BackupLensPrefs {
  horizonLens: string | null;
  projectsLens: string | null;
  horizonSecondaryMap: SecondaryLensMap;
}

export interface BackupHorizonView {
  id: string;
  name: string;
  primary_scheme: string;
  splits: string;
  sort_by: string;
}

export interface BackupHorizonPrefs {
  default_view_id: string | null;
  default_lens_id: string | null;
  secondary_map: string;
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
  horizonViews: BackupHorizonView[];
  horizonPrefs: BackupHorizonPrefs | null;
}

export const BACKUP_VERSION = 4;

export function isValidBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.ideas) && Array.isArray(obj.ideaLinks);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Accepts v1 backups (no tags/taskTags), v2 backups (no
 * quickNotes/classifications/lensPrefs) and v3 backups (no
 * horizonViews/horizonPrefs) by defaulting new fields to empty.
 */
export function normalizeBackup(data: BackupData): BackupData {
  const obj = data as unknown as Record<string, unknown>;
  return {
    ...data,
    version: typeof obj.version === "number" ? obj.version : 1,
    ideas: asArray<Idea>(obj.ideas).map((idea) => ({
      ...idea,
      why: (idea as Partial<Idea>).why ?? null,
    })),
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
    horizonViews: asArray<BackupHorizonView>(obj.horizonViews),
    horizonPrefs:
      obj.horizonPrefs && typeof obj.horizonPrefs === "object"
        ? (obj.horizonPrefs as BackupHorizonPrefs)
        : null,
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
    rawHorizonViews,
    rawHorizonPrefs,
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
    db.getAll<BackupHorizonView>(
      "SELECT id, name, primary_scheme, splits, sort_by FROM horizon_views WHERE user_id = ?",
      [user.id],
    ),
    db.getAll<BackupHorizonPrefs>(
      "SELECT default_view_id, default_lens_id, secondary_map FROM horizon_prefs WHERE user_id = ?",
      [user.id],
    ),
  ]);

  // Deserialize JSON text columns stored by PowerSync
  const ideas: Idea[] = rawIdeas.map(
    (row: Record<string, unknown>) =>
      ({
        ...row,
        why: (row.why as string | null) ?? null,
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
    lensPrefs: null,
    horizonViews: rawHorizonViews,
    horizonPrefs: rawHorizonPrefs[0] ?? null,
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
 * Additive merge restore for Horizon views (INSERT OR IGNORE, never deletes).
 * Invalid rows are skipped. Returns the number of valid rows imported.
 */
export async function restoreHorizonViews(
  db: AbstractPowerSyncDatabase,
  userId: string,
  views: BackupHorizonView[],
): Promise<number> {
  const clean = views
    .map((v) =>
      sanitizeView({
        id: v.id,
        name: v.name,
        primary: v.primary_scheme,
        splits: parseSecondaryMapText(v.splits),
        sortBy: v.sort_by,
      }),
    )
    .filter((v) => v !== null);
  if (clean.length === 0) return 0;
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    for (const v of clean) {
      await tx.execute(
        `INSERT OR IGNORE INTO horizon_views (id, user_id, name, primary_scheme, splits, sort_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        [
          v.id,
          userId,
          v.name,
          v.primary,
          JSON.stringify(v.splits ?? {}),
          v.sortBy ?? "manual",
          now,
          now,
        ],
      );
    }
  });
  return clean.length;
}

/**
 * Restore Horizon prefs + legacy lens prefs only onto an empty DB — never
 * overwrite this device's synced config. Old (v2/v3) backups carry
 * `lensPrefs` (localStorage-era active lens + secondary map); v4 backups
 * carry `horizonPrefs`/`horizonViews`. Returns what was restored.
 */
export async function restoreHorizonLensConfig(
  db: AbstractPowerSyncDatabase,
  userId: string,
  data: Pick<BackupData, "horizonViews" | "horizonPrefs" | "lensPrefs">,
): Promise<string[]> {
  const restored: string[] = [];
  const viewsImported = await restoreHorizonViews(db, userId, data.horizonViews ?? []);
  if (viewsImported > 0) restored.push(`horizon_views:${viewsImported}`);
  const existingViews = await db.getAll<Record<string, unknown>>(
    `SELECT id FROM horizon_views WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const existingPrefs = await db.getAll<Record<string, unknown>>(
    `SELECT * FROM horizon_prefs WHERE user_id = ?`,
    [userId],
  );
  if (existingPrefs.length > 0) return restored;
  // Prefer the v4 prefs row; fall back to the legacy secondary map.
  const legacyMap = parseSecondaryMapText(data.lensPrefs?.horizonSecondaryMap);
  const secondaryMap = data.horizonPrefs
    ? parseSecondaryMapText(data.horizonPrefs.secondary_map)
    : legacyMap;
  const hasContent =
    (data.horizonPrefs != null &&
      (data.horizonPrefs.default_view_id != null || data.horizonPrefs.default_lens_id != null)) ||
    Object.keys(secondaryMap).length > 0;
  if (!hasContent) return restored;
  // Only adopt a default view that actually exists (restored above or local).
  let defaultViewId = data.horizonPrefs?.default_view_id ?? null;
  if (defaultViewId && existingViews.length === 0 && viewsImported === 0) defaultViewId = null;
  if (defaultViewId) {
    const found = await db.getOptional<Record<string, unknown>>(
      `SELECT id FROM horizon_views WHERE id = ?`,
      [defaultViewId],
    );
    if (!found) defaultViewId = null;
  }
  await db.execute(
    `INSERT OR IGNORE INTO horizon_prefs (id, user_id, default_view_id, default_lens_id, secondary_map, updated_at) VALUES (?,?,?,?,?,?)`,
    [
      horizonPrefsId(userId),
      userId,
      defaultViewId,
      data.horizonPrefs?.default_lens_id ?? null,
      JSON.stringify(secondaryMap),
      new Date().toISOString(),
    ],
  );
  restored.push("horizon_prefs");
  // The legacy active lens is local device state: adopt it via uiPrefs only
  // when this device never chose one (still the default "term").
  const legacyLens = data.lensPrefs?.horizonLens;
  if (legacyLens && useUiPrefsStore.getState().horizonLens === "term") {
    useUiPrefsStore.getState().set({ horizonLens: legacyLens });
    restored.push("horizonLens");
  }
  const legacyProjectsLens = data.lensPrefs?.projectsLens;
  if (legacyProjectsLens && useUiPrefsStore.getState().projectsLens === "term") {
    useUiPrefsStore.getState().set({ projectsLens: legacyProjectsLens });
    restored.push("projectsLens");
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
