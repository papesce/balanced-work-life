alter table public.ideas
  add column scheduled_date date,
  add column done_at timestamptz;

create index idx_ideas_scheduled_date
  on public.ideas(user_id, scheduled_date)
  where scheduled_date is not null;
