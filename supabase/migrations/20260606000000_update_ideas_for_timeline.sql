-- Update ideas table for Timeline view
alter table public.ideas
  add column scheduled_time time,
  add column duration_minutes integer,
  add column is_priority boolean not null default false,
  add column priority_order integer,
  add column status text check (status in ('inbox', 'scheduled', 'completed', 'archived')) default 'inbox',
  add column notes text;

-- Update existing tasks to have a default status based on done_at and scheduled_date
update public.ideas
set status = case
  when done_at is not null then 'completed'
  when scheduled_date is not null then 'scheduled'
  else 'inbox'
end
where type = 'task' and status = 'inbox';
