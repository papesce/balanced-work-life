create table public.tasks (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'done')),
  time_bucket text not null default 'today' check (time_bucket in ('today', 'tomorrow', 'next_week', 'backlog')),
  balance_category text not null default 'work' check (balance_category in ('work', 'life')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

create index idx_tasks_user_id on public.tasks(user_id);
create index idx_tasks_status on public.tasks(user_id, status);
