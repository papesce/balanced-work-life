-- Remove the legacy per-project workflow canvas document. Paths
-- (paths + path_items) replaced it; the old data has no value and is not
-- migrated. The sync stream was already removed and deployed before this.
drop table if exists public.project_workflows;
