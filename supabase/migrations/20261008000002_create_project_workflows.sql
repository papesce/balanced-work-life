create table public.project_workflows (
  id uuid primary key references public.ideas(id) on delete cascade,
  project_id uuid unique references public.ideas(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  document jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.project_workflows enable row level security;
create policy "Users own their project_workflows" on public.project_workflows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_project_workflows_user on public.project_workflows(user_id);

do $$ begin
  alter publication powersync add table public.project_workflows;
exception when duplicate_object then null;
end $$;
