ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS horizon text
  CHECK (horizon IN ('short', 'medium', 'long'));
