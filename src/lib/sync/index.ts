"use client";

import { uploadClassificationOptions } from "./classification_options";
import { uploadClassificationSchemes } from "./classification_schemes";
import { uploadHorizonPrefs } from "./horizon_prefs";
import { uploadHorizonViews } from "./horizon_views";
import { uploadIdeaClassifications } from "./idea_classifications";
import type { TableUploadHandler } from "./op";
import { uploadPathItems } from "./path_items";
import { uploadPathEdges } from "./path_edges";
import { uploadTaskTags } from "./task_tags";

/** Per-table upload handlers. Tables without an entry use the generic PUT/PATCH/DELETE. */
export const TABLE_UPLOAD_HANDLERS: Record<string, TableUploadHandler> = {
  task_tags: uploadTaskTags,
  classification_schemes: uploadClassificationSchemes,
  classification_options: uploadClassificationOptions,
  idea_classifications: uploadIdeaClassifications,
  path_items: uploadPathItems,
  path_edges: uploadPathEdges,
  horizon_views: uploadHorizonViews,
  horizon_prefs: uploadHorizonPrefs,
};
