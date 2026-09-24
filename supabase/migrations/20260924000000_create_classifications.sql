-- Classifications: user-scoped prioritization frameworks (v1: term, nnl, moscow).
-- Schemes/options are seed data (client lazily inserts per user); no add/edit UI in v1.
-- idea_classifications PRIMARY KEY (idea_id, scheme_id) enforces single-value per scheme.
-- Unclassified = no row (rendered explicitly, never defaulted).

create table if not exists public.classification_schemes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 32),
  label text not null check (char_length(label) between 1 and 32),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.classification_schemes enable row level security;
drop policy if exists "Users own their classification_schemes" on public.classification_schemes;
create policy "Users own their classification_schemes" on public.classification_schemes
  for all using (auth.uid() = user_id);

create index if not exists idx_classification_schemes_user on public.classification_schemes(user_id);

create table if not exists public.classification_options (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.classification_schemes(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 32),
  label text not null check (char_length(label) between 1 and 32),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (scheme_id, value)
);

alter table public.classification_options enable row level security;
drop policy if exists "Users own their classification_options" on public.classification_options;
create policy "Users own their classification_options" on public.classification_options
  for all using (
    auth.uid() = (select user_id from public.classification_schemes where id = scheme_id)
  );

create index if not exists idx_classification_options_scheme on public.classification_options(scheme_id);

create table if not exists public.idea_classifications (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  scheme_id uuid not null references public.classification_schemes(id) on delete cascade,
  option_id uuid not null references public.classification_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, scheme_id)
);

alter table public.idea_classifications enable row level security;
drop policy if exists "Users own their idea_classifications" on public.idea_classifications;
create policy "Users own their idea_classifications" on public.idea_classifications
  for all using (auth.uid() = user_id);

create index if not exists idx_idea_classifications_idea on public.idea_classifications(idea_id);
create index if not exists idx_idea_classifications_scheme on public.idea_classifications(scheme_id);

-- PowerSync publication (required for sync) - idempotent
do $$ begin
  alter publication powersync add table public.classification_schemes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication powersync add table public.classification_options;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication powersync add table public.idea_classifications;
exception when duplicate_object then null;
end $$;
