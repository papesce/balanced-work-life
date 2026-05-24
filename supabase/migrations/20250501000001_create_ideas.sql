create table public.ideas (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_id uuid references public.ideas(id) on delete cascade,
  text text not null default '',
  type text check (type in ('idea', 'objective', 'project', 'initiative', 'task')),
  area text check (area in ('work', 'health', 'relationships', 'growth', 'finances', 'life')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ideas enable row level security;

create policy "Users can view own ideas"
  on public.ideas for select
  using (auth.uid() = user_id);

create policy "Users can insert own ideas"
  on public.ideas for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ideas"
  on public.ideas for update
  using (auth.uid() = user_id);

create policy "Users can delete own ideas"
  on public.ideas for delete
  using (auth.uid() = user_id);

create index idx_ideas_user_id on public.ideas(user_id);
create index idx_ideas_parent_id on public.ideas(user_id, parent_id);
