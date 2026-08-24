-- Horizon lanes: user-configurable, 0-5 per horizon, stable ids, ordered by created_at ASC
-- Idempotent for re-push after history squash (20260824010000/26000000/27000000/28000000 reverted)

create table if not exists public.horizon_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  horizon text not null check (horizon in ('short','medium','long')),
  unassigned_label text not null default 'Unassigned' check (char_length(unassigned_label) between 1 and 30),
  unique (user_id, horizon)
);

alter table public.horizon_settings enable row level security;
drop policy if exists "Users can view own horizon_settings" on public.horizon_settings;
create policy "Users can view own horizon_settings" on public.horizon_settings for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own horizon_settings" on public.horizon_settings;
create policy "Users can insert own horizon_settings" on public.horizon_settings for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own horizon_settings" on public.horizon_settings;
create policy "Users can update own horizon_settings" on public.horizon_settings for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own horizon_settings" on public.horizon_settings;
create policy "Users can delete own horizon_settings" on public.horizon_settings for delete using (auth.uid() = user_id);

create table if not exists public.lane_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  horizon text not null check (horizon in ('short','medium','long')),
  label text not null check (char_length(label) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, horizon, label)
);

alter table public.lane_configs enable row level security;
drop policy if exists "Users can view own lane_configs" on public.lane_configs;
create policy "Users can view own lane_configs" on public.lane_configs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own lane_configs" on public.lane_configs;
create policy "Users can insert own lane_configs" on public.lane_configs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own lane_configs" on public.lane_configs;
create policy "Users can update own lane_configs" on public.lane_configs for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own lane_configs" on public.lane_configs;
create policy "Users can delete own lane_configs" on public.lane_configs for delete using (auth.uid() = user_id);

create index if not exists idx_lane_configs_user_horizon on public.lane_configs(user_id, horizon, created_at);

-- Focus lane: stable uuid reference to lane_configs (null = unassigned)
do $$ begin
  alter table public.ideas add column focus_lane uuid references public.lane_configs(id) on delete set null;
exception when duplicate_column then null;
end $$;

-- PowerSync publication (required for sync) - idempotent
do $$ begin
  alter publication powersync add table public.lane_configs;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication powersync add table public.horizon_settings;
exception when duplicate_object then null;
end $$;
