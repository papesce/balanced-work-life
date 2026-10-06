-- Add 'missed' terminal status for tasks that could not be attended
ALTER TABLE public.ideas
  DROP CONSTRAINT IF EXISTS ideas_status_check;

ALTER TABLE public.ideas
  ADD CONSTRAINT ideas_status_check
    CHECK (status IN ('draft', 'planned', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'missed', 'archived', 'deferred'));
