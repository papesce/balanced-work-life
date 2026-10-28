"use client";

import { column, Schema, Table } from "@powersync/web";

export const IdeasTable = new Table(
  {
    user_id: column.text,
    parent_id: column.text,
    text: column.text,
    description: column.text,
    type: column.text,
    effort: column.real,
    impact: column.real,
    urgency: column.real,
    scheduled_date: column.text,
    scheduled_time: column.text,
    duration_minutes: column.integer,
    is_priority: column.integer,
    priority_order: column.integer,
    status: column.text,
    notes: column.text,
    why: column.text,
    completed_at: column.text,
    cancelled_at: column.text,
    paused_at: column.text,
    attempt_dates: column.text,
    status_history: column.text,
    productivity_signal: column.text,
    sort_order: column.real,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

export const IdeaLinksTable = new Table(
  {
    user_id: column.text,
    source_id: column.text,
    target_id: column.text,
    link_type: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

export const TagsTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    area: column.text,
    is_system: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const TaskTagsTable = new Table(
  {
    id: column.text,
    idea_id: column.text,
    tag_id: column.text,
    user_id: column.text,
  },
  { indexes: {} },
);

export const QuickNotesTable = new Table(
  {
    user_id: column.text,
    text: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
    archived_at: column.text,
    deleted_at: column.text,
  },
  { indexes: {} },
);

export const ClassificationSchemesTable = new Table(
  {
    user_id: column.text,
    key: column.text,
    label: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const ClassificationOptionsTable = new Table(
  {
    scheme_id: column.text,
    value: column.text,
    label: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

export const IdeaClassificationsTable = new Table(
  {
    idea_id: column.text,
    scheme_id: column.text,
    option_id: column.text,
    user_id: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

export const HorizonViewsTable = new Table(
  {
    user_id: column.text,
    name: column.text,
    primary_scheme: column.text,
    description: column.text,
    column_order: column.text,
    splits: column.text,
    is_builtin: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

export const HorizonPrefsTable = new Table(
  {
    user_id: column.text,
    default_view_id: column.text,
    default_lens_id: column.text,
    secondary_map: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

export const PathItemsTable = new Table(
  {
    user_id: column.text,
    path_id: column.text,
    title: column.text,
    notes: column.text,
    idea_id: column.text,
    completed_at: column.text,
    promoted_at: column.text,
    x: column.real,
    y: column.real,
    created_at: column.text,
  },
  { indexes: {} },
);

export const PathEdgesTable = new Table(
  {
    user_id: column.text,
    path_id: column.text,
    from_item_id: column.text,
    to_item_id: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

export const AppSchema = new Schema({
  ideas: IdeasTable,
  idea_links: IdeaLinksTable,
  tags: TagsTable,
  task_tags: TaskTagsTable,
  quick_notes: QuickNotesTable,
  classification_schemes: ClassificationSchemesTable,
  classification_options: ClassificationOptionsTable,
  idea_classifications: IdeaClassificationsTable,
  horizon_views: HorizonViewsTable,
  horizon_prefs: HorizonPrefsTable,
  path_items: PathItemsTable,
  path_edges: PathEdgesTable,
});

// Allowlist of tables the connector knows how to upload. An unknown op.table
// (stale client, schema drift, bad local write) must be skipped — never thrown —
// otherwise batch.complete() is never reached and the upload queue wedges
// behind a single poisoned op.
export const KNOWN_UPLOAD_TABLES: ReadonlySet<string> = new Set([
  "ideas",
  "idea_links",
  "tags",
  "task_tags",
  "quick_notes",
  "classification_schemes",
  "classification_options",
  "idea_classifications",
  "horizon_views",
  "horizon_prefs",
  "path_items",
  "path_edges",
]);
