alter table public.ideas
  add column effort smallint check (effort >= 1 and effort <= 5),
  add column impact smallint check (impact >= 1 and impact <= 5),
  add column urgency smallint check (urgency >= 1 and urgency <= 5);
