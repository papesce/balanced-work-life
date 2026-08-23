alter table ideas
  add column in_focus boolean not null default false,
  add column in_focus_until date null;
