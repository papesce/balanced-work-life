-- Add idea_id to tasks for bidirectional idea-task linking
alter table public.tasks
  add column idea_id uuid references public.ideas(id) on delete set null;

-- Fast lookup: idea → its tasks
create index tasks_idea_id_idx on public.tasks(idea_id);

-- Only one active task per idea at a time
create unique index tasks_idea_id_active_uniq
  on public.tasks(idea_id)
  where status = 'active' and idea_id is not null;
