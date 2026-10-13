"use client";

import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./powersyncSchema";

export { AppSchema } from "./powersyncSchema";
export {
  IdeasTable,
  IdeaLinksTable,
  TagsTable,
  TaskTagsTable,
  QuickNotesTable,
  ClassificationSchemesTable,
  ClassificationOptionsTable,
  IdeaClassificationsTable,
  HorizonViewsTable,
  HorizonPrefsTable,
  PathsTable,
  PathItemsTable,
} from "./powersyncSchema";
export { SupabaseConnector, normalizeIdeasPayload } from "./supabaseConnector";

let powerSyncInstance: PowerSyncDatabase | null = null;

export function getPowerSync(): PowerSyncDatabase {
  if (powerSyncInstance) return powerSyncInstance;

  powerSyncInstance = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      dbFilename: "balanced-work-life.db",
    },
  });

  return powerSyncInstance;
}
