-- Rename 'inbox' status to 'draft'

-- 1. Drop old constraint so UPDATE can write 'draft'
ALTER TABLE public.ideas
  DROP CONSTRAINT IF EXISTS ideas_status_check;

-- 2. Migrate existing data
UPDATE public.ideas SET status = 'draft' WHERE status = 'inbox';

-- 3. Add new constraint with 'draft' replacing 'inbox'
ALTER TABLE public.ideas
  ADD CONSTRAINT ideas_status_check
    CHECK (status IN ('draft', 'planned', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'archived', 'deferred'));
