alter table public.path_items
  add column if not exists completed_at timestamptz;

alter table public.path_items
  add column if not exists promoted_at timestamptz;
