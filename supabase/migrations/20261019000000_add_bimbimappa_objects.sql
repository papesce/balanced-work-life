-- BimbiMappa owns these objects. They live in the shared Supabase project
-- but are not part of Balanced Work Life's application data. Keep them when
-- reviewing or cleaning up tables, policies, storage, or Realtime configuration.

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  notes text,
  source_url text,
  links jsonb default '[]',
  category text,
  amenities text[] not null default '{}'::text[],
  price_tier smallint,
  priority smallint,
  rating smallint,
  date_from date,
  date_to date,
  photo_url text,
  visited boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  priority smallint not null default 1,
  place_ids uuid[] not null default '{}'::uuid[],
  target_date text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

comment on table public.places is
  'Owned by BimbiMappa. Keep this table and its policies when cleaning up Balanced Work Life database objects.';
comment on table public.trips is
  'Owned by BimbiMappa. Keep this table and its policies when cleaning up Balanced Work Life database objects.';

alter table public.places enable row level security;
alter table public.trips enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'places' and policyname = 'Public read') then
    create policy "Public read" on public.places for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'places' and policyname = 'Public insert') then
    create policy "Public insert" on public.places for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'places' and policyname = 'Public delete') then
    create policy "Public delete" on public.places for delete using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'places' and policyname = 'Public update') then
    create policy "Public update" on public.places for update using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trips' and policyname = 'Public read trips') then
    create policy "Public read trips" on public.trips for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trips' and policyname = 'Public insert trips') then
    create policy "Public insert trips" on public.trips for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trips' and policyname = 'Public delete trips') then
    create policy "Public delete trips" on public.trips for delete using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trips' and policyname = 'Public update trips') then
    create policy "Public update trips" on public.trips for update using (true);
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read place photos') then
    create policy "Public read place photos" on storage.objects for select using (bucket_id = 'place-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public insert place photos') then
    create policy "Public insert place photos" on storage.objects for insert with check (bucket_id = 'place-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public update place photos') then
    create policy "Public update place photos" on storage.objects for update using (bucket_id = 'place-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public delete place photos') then
    create policy "Public delete place photos" on storage.objects for delete using (bucket_id = 'place-photos');
  end if;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.places;
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null;
end
$$;
