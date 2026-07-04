-- Migrate from binary done/undone to expressive task statuses

-- 1. Rename done_at → completed_at, add new columns
alter table public.ideas
  rename column done_at to completed_at;

alter table public.ideas
  add column cancelled_at timestamptz,
  add column paused_at timestamptz;

-- 2. Update status CHECK constraint to include new values
alter table public.ideas
  drop constraint if exists ideas_status_check;

alter table public.ideas
  add constraint ideas_status_check
    check (status in ('inbox', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived'));

-- 3. Backfill: tasks with completed_at set should have status = 'completed'
update public.ideas
  set status = 'completed'
  where completed_at is not null and status != 'completed';
