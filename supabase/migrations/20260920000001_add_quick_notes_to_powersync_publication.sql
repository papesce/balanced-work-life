-- Add quick_notes to the PowerSync publication (required for sync)
-- The table was created in 20260920000000 but never added to the publication.
do $$ begin
  alter publication powersync add table public.quick_notes;
exception when duplicate_object then null;
end $$;
