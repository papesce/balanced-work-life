-- Migrate existing tasks into ideas, then drop the tasks table.
-- Mapping:
--   task.title        → idea.text
--   task.balance_category 'work' → idea.area 'work', 'life' → idea.area 'life'
--   task.time_bucket  → idea.scheduled_date:
--       'today'     → current_date
--       'tomorrow'  → current_date + 1
--       'next_week' → next Monday (current_date + (8 - dow) % 7, min 2 days out)
--       'backlog'   → NULL
--   task.status 'done' → idea.done_at = task.completed_at (or task.updated_at as fallback)
--   idea.type = 'task'
--   idea.sort_order = 0 (will appear at top)
--
-- Tasks that already have an idea_id (were promoted from an idea) are skipped —
-- their source idea already exists in the tree.

-- Step 1: Insert tasks that DON'T already have a linked idea
insert into public.ideas (
  id,
  user_id,
  parent_id,
  text,
  type,
  area,
  effort,
  impact,
  urgency,
  scheduled_date,
  done_at,
  sort_order,
  created_at,
  updated_at
)
select
  t.id,
  t.user_id,
  null,                                          -- parent_id (root level)
  t.title,                                       -- text
  'task',                                        -- type
  case t.balance_category
    when 'work' then 'work'
    else 'life'
  end,                                           -- area
  null,                                          -- effort
  null,                                          -- impact
  null,                                          -- urgency
  case
    when t.status = 'done' then coalesce(t.completed_at::date, t.updated_at::date)
    when t.time_bucket = 'today'    then current_date
    when t.time_bucket = 'tomorrow' then current_date + 1
    when t.time_bucket = 'next_week' then current_date + ((8 - extract(dow from current_date)::int) % 7) +
                          case when ((8 - extract(dow from current_date)::int) % 7) = 0 then 7 else 0 end
    else null                                    -- backlog → unscheduled
  end,                                           -- scheduled_date
  case t.status
    when 'done' then coalesce(t.completed_at, t.updated_at)
    else null
  end,                                           -- done_at
  0,                                             -- sort_order
  t.created_at,
  t.updated_at
from public.tasks t
where t.idea_id is null;

-- Step 2: For tasks that WERE promoted from an idea, update the source idea
-- to inherit the scheduling info (if the idea doesn't already have it)
update public.ideas i
set
  scheduled_date = case
    when t.status = 'done' then coalesce(t.completed_at::date, t.updated_at::date)
    when t.time_bucket = 'today'    then current_date
    when t.time_bucket = 'tomorrow' then current_date + 1
    when t.time_bucket = 'next_week' then current_date + ((8 - extract(dow from current_date)::int) % 7) +
                          case when ((8 - extract(dow from current_date)::int) % 7) = 0 then 7 else 0 end
    else i.scheduled_date
  end,
  done_at = case
    when t.status = 'done' and i.done_at is null
      then coalesce(t.completed_at, t.updated_at)
    else i.done_at
  end,
  updated_at = now()
from public.tasks t
where t.idea_id = i.id
  and t.idea_id is not null;

-- Step 3: Drop the tasks table
drop index if exists public.tasks_idea_id_active_uniq;
drop index if exists public.tasks_idea_id_idx;
drop index if exists public.idx_tasks_user_id;
drop index if exists public.idx_tasks_status;

drop policy if exists "Users can view own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can create own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can delete own tasks" on public.tasks;

drop table if exists public.tasks;
