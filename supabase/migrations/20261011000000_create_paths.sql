-- Paths: named partial execution traces inside a project (view over tasks).
-- Membership + layout live in path_items; dependencies stay in idea_links.
-- Additive only: no changes to ideas, idea_links, or project_workflows.

create table public.paths (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.ideas(id) on delete cascade,
  title text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.path_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.paths(id) on delete cascade,
  idea_id uuid not null references public.ideas(id) on delete cascade,
  x real not null default 0,
  y real not null default 0,
  created_at timestamptz not null default now(),
  unique (path_id, idea_id)
);

alter table public.paths enable row level security;
create policy "Users own their paths" on public.paths
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.path_items enable row level security;
create policy "Users own their path_items" on public.path_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_paths_user on public.paths(user_id);
create index idx_paths_project on public.paths(project_id);
create index idx_path_items_user on public.path_items(user_id);
create index idx_path_items_path on public.path_items(path_id);
create index idx_path_items_idea on public.path_items(idea_id);

do $$ begin
  alter publication powersync add table public.paths;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication powersync add table public.path_items;
exception when duplicate_object then null;
end $$;
