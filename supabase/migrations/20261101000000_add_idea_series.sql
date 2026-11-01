alter table public.ideas
  add column if not exists series_id uuid null;

create index if not exists ideas_series_id_idx
  on public.ideas (series_id);
