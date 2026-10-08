-- Add horizon lens-config tables to the PowerSync publication (required for sync)
do $$ begin
  alter publication powersync add table public.horizon_views;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication powersync add table public.horizon_prefs;
exception when duplicate_object then null;
end $$;
