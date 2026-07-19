ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS attempt_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ideas
  DROP CONSTRAINT IF EXISTS ideas_status_check;

ALTER TABLE public.ideas
  ADD CONSTRAINT ideas_status_check
    CHECK (status IN ('inbox', 'planned', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived', 'deferred'));
