-- Add 'planned' to the allowed task statuses.
-- The 'planned' status and its UI picker were added in app code (commit af2f21f),
-- but the database CHECK constraint was never updated, so setting a task to
-- 'planned' was rejected by Postgres.

alter table public.ideas
  drop constraint if exists ideas_status_check;

alter table public.ideas
  add constraint ideas_status_check
    check (status in ('inbox', 'planned', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'));
