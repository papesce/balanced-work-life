create table public.idea_links (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source_id uuid references public.ideas(id) on delete cascade not null,
  target_id uuid references public.ideas(id) on delete cascade not null,
  link_type text not null check (link_type in ('unblocks', 'contributes_to', 'depends_on', 'related_to', 'part_of')),
  created_at timestamptz not null default now(),
  constraint no_self_link check (source_id != target_id),
  constraint unique_link unique (source_id, target_id, link_type)
);

alter table public.idea_links enable row level security;

create policy "Users can view own idea_links"
  on public.idea_links for select using (auth.uid() = user_id);
create policy "Users can insert own idea_links"
  on public.idea_links for insert with check (auth.uid() = user_id);
create policy "Users can delete own idea_links"
  on public.idea_links for delete using (auth.uid() = user_id);

create index idx_idea_links_user on public.idea_links(user_id);
create index idx_idea_links_source on public.idea_links(source_id);
create index idx_idea_links_target on public.idea_links(target_id);
