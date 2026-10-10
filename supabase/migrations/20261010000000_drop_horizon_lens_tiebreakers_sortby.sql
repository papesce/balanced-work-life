-- Drop the removed tiebreaker/sort columns from horizon_views.
-- In-column ordering now comes from each column's secondary (split)
-- scheme; there is no lens-level tiebreaker list and no manual/priority
-- toggle, so both columns (tiebreakers from the editable-lens migration,
-- sort_by with its CHECK from the lens-config migration) are dead.
ALTER TABLE public.horizon_views DROP COLUMN tiebreakers;
ALTER TABLE public.horizon_views DROP COLUMN sort_by;
