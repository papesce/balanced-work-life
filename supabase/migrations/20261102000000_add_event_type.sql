do $$
begin
  alter table public.ideas drop constraint if exists ideas_type_check;
  alter table public.ideas
    add constraint ideas_type_check
    check (type in ('idea', 'objective', 'project', 'initiative', 'task', 'path', 'event'));
end
$$;

do $$
begin
  alter table public.ideas drop constraint if exists ideas_status_check;
  alter table public.ideas
    add constraint ideas_status_check
    check (status in (
      'draft', 'planned', 'scheduled', 'in_progress', 'paused', 'completed',
      'cancelled', 'missed', 'archived', 'deferred', 'not_applicable'
    ));
end
$$;

do $$
begin
  alter table public.ideas
    add constraint ideas_event_scheduled_date_check
    check (type <> 'event' or scheduled_date is not null);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.ideas
    add constraint ideas_event_root_check
    check (type <> 'event' or parent_id is null);
exception
  when duplicate_object then null;
end
$$;
