-- Refactor Paths to be first-class entities.
-- A Path is now an Idea of type 'path'.
-- Nodes can be placeholders (idea_id is nullable).
-- Edges are stored separately since placeholders have no idea_id.

-- 1. Preserve the existing project paths and layouts during the conversion.
alter table public.paths rename to paths_legacy_20261022;
alter table public.path_items rename to path_items_legacy_20261022;

-- 2. Create new path_items table
create table public.path_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.ideas(id) on delete cascade,
  title text not null default '',
  idea_id uuid references public.ideas(id) on delete cascade,
  x real not null default 0,
  y real not null default 0,
  created_at timestamptz not null default now(),
  unique (path_id, idea_id)
);

-- 3. Create path_edges table
create table public.path_edges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.ideas(id) on delete cascade,
  from_item_id uuid not null references public.path_items(id) on delete cascade,
  to_item_id uuid not null references public.path_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (path_id, from_item_id, to_item_id)
);

alter table public.ideas drop constraint if exists ideas_type_check;
alter table public.ideas add constraint ideas_type_check
  check (type in ('idea', 'objective', 'project', 'initiative', 'task', 'path'));

alter table public.idea_links drop constraint if exists idea_links_link_type_check;
alter table public.idea_links add constraint idea_links_link_type_check
  check (link_type in ('unblocks', 'contributes_to', 'depends_on', 'related_to', 'part_of', 'path_of'));

-- Preserve path identity, project associations, and the existing canvas
-- positions. A path keeps its old UUID so client preferences remain useful.
insert into public.ideas (id, user_id, text, type, status, created_at, updated_at)
select id, user_id, title, 'path', 'draft', created_at, updated_at
from public.paths_legacy_20261022;

insert into public.idea_links (id, user_id, source_id, target_id, link_type, created_at)
select gen_random_uuid(), user_id, id, project_id, 'path_of', created_at
from public.paths_legacy_20261022;

insert into public.path_items (id, user_id, path_id, title, idea_id, x, y, created_at)
select old_item.id, old_item.user_id, old_item.path_id, coalesce(task.text, ''), old_item.idea_id,
       old_item.x, old_item.y, old_item.created_at
from public.path_items_legacy_20261022 old_item
left join public.ideas task on task.id = old_item.idea_id;

-- Convert dependencies between tasks in the same path into path-owned edges.
-- depends_on is stored task -> prerequisite, so the visual edge points
-- prerequisite -> dependent.
insert into public.path_edges (id, user_id, path_id, from_item_id, to_item_id, created_at)
select gen_random_uuid(), dependent.user_id, dependent.path_id, prerequisite.id, dependent.id, now()
from public.idea_links dependency
join public.path_items dependent on dependent.idea_id = dependency.source_id
join public.path_items prerequisite on prerequisite.idea_id = dependency.target_id
  and prerequisite.path_id = dependent.path_id
where dependency.link_type = 'depends_on'
on conflict (path_id, from_item_id, to_item_id) do nothing;

drop table public.path_items_legacy_20261022;
drop table public.paths_legacy_20261022;

-- 4. RLS and Policies
alter table public.path_items enable row level security;
create policy "Users own their path_items" on public.path_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.path_edges enable row level security;
create policy "Users own their path_edges" on public.path_edges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Indexes
create index idx_path_items_user on public.path_items(user_id);
create index idx_path_items_path on public.path_items(path_id);
create index idx_path_items_idea on public.path_items(idea_id);
create index idx_path_edges_user on public.path_edges(user_id);
create index idx_path_edges_path on public.path_edges(path_id);

-- 6. PowerSync Publication
do $$ begin
  alter publication powersync add table public.path_items;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication powersync add table public.path_edges;
exception when duplicate_object then null;
end $$;
