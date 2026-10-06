-- Add why column to ideas: free-text purpose/motivation, later linkable to goals/initiatives.
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS why text;
