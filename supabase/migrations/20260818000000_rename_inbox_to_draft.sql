-- Rename 'inbox' status to 'draft'
UPDATE public.ideas SET status = 'draft' WHERE status = 'inbox';

ALTER TABLE public.ideas
  DROP CONSTRAINT IF EXISTS ideas_status_check;

ALTER TABLE public.ideas
  ADD CONSTRAINT ideas_status_check
    CHECK (status IN ('draft', 'planned', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived', 'deferred'));
