-- Add productivity_signal column to ideas table
-- Default: 'productive'. NULL only if explicitly set.
ALTER TABLE public.ideas
  ADD COLUMN productivity_signal text DEFAULT 'productive' CHECK (productivity_signal IN ('productive', 'lazy', NULL));

-- Index for future analytics: GROUP BY productivity_signal, date_trunc('week', scheduled_date)
CREATE INDEX idx_ideas_productivity_signal ON public.ideas(productivity_signal, scheduled_date);
