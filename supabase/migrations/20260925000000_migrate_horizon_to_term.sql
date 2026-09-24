-- Migrate the legacy horizon column to the Term classification scheme, then
-- delete the old horizon model (ideas.horizon, ideas.focus_lane, lane_configs,
-- horizon_settings). Lane labels/assignments are intentionally not preserved:
-- free-text per-horizon lanes cannot map onto fixed Term values.
--
-- Order matters: seed -> backfill -> drop. All seed/backfill statements are
-- idempotent (NOT EXISTS guards) so re-push is safe.

-- 1. Seed the fixed schemes + options for every known user
-- (client seeding covers brand-new users on first load).
insert into public.classification_schemes (user_id, key, label, sort_order)
select u.user_id, s.key, s.label, s.sort_order
from (
  select distinct user_id from public.ideas
  union
  select distinct user_id from public.classification_schemes
) u
cross join (values
  ('term', 'Term', 0),
  ('nnl', 'NNL', 1),
  ('moscow', 'MoSCoW', 2),
  ('when', 'When', 3)
) as s(key, label, sort_order)
where not exists (
  select 1 from public.classification_schemes existing
  where existing.user_id = u.user_id and existing.key = s.key
);

insert into public.classification_options (scheme_id, value, label, sort_order)
select s.id, v.value, v.label, v.sort_order
from public.classification_schemes s
join (values
  ('term', 'short', 'Short', 0),
  ('term', 'medium', 'Medium', 1),
  ('term', 'long', 'Long', 2),
  ('nnl', 'now', 'Now', 0),
  ('nnl', 'next', 'Next', 1),
  ('nnl', 'later', 'Later', 2),
  ('moscow', 'must', 'Must', 0),
  ('moscow', 'should', 'Should', 1),
  ('moscow', 'could', 'Could', 2),
  ('moscow', 'wont', 'Won''t', 3),
  ('when', 'this_week', 'This week', 0),
  ('when', 'next_week', 'Next week', 1),
  ('when', 'this_month', 'This month', 2),
  ('when', 'next_month', 'Next month', 3),
  ('when', 'this_year', 'This year', 4),
  ('when', 'next_year', 'Next year', 5),
  ('when', 'later', 'Later', 6)
) as v(key, value, label, sort_order) on v.key = s.key
where not exists (
  select 1 from public.classification_options existing
  where existing.scheme_id = s.id and existing.value = v.value
);

-- 2. Backfill Term classifications from the legacy horizon column
insert into public.idea_classifications (idea_id, scheme_id, option_id, user_id)
select i.id, s.id, o.id, i.user_id
from public.ideas i
join public.classification_schemes s
  on s.user_id = i.user_id and s.key = 'term'
join public.classification_options o
  on o.scheme_id = s.id and o.value = i.horizon
where i.horizon is not null
and not exists (
  select 1 from public.idea_classifications existing
  where existing.idea_id = i.id and existing.scheme_id = s.id
);

-- 3. Drop the old model
alter table public.ideas drop column if exists focus_lane;
alter table public.ideas drop column if exists horizon;

-- ALTER PUBLICATION ... DROP TABLE has no IF EXISTS on this Postgres
-- version, so guard on the publication membership catalog instead.
do $$ begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'lane_configs'
  ) then
    alter publication powersync drop table public.lane_configs;
  end if;
end $$;
do $$ begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'powersync' and schemaname = 'public' and tablename = 'horizon_settings'
  ) then
    alter publication powersync drop table public.horizon_settings;
  end if;
end $$;
drop table if exists public.lane_configs;
drop table if exists public.horizon_settings;
