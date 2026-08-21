-- Add id and user_id to task_tags for PowerSync compatibility
ALTER TABLE public.task_tags
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from the related idea
UPDATE public.task_tags tt
SET user_id = i.user_id
FROM public.ideas i
WHERE tt.idea_id = i.id;

-- Make user_id NOT NULL after backfill
ALTER TABLE public.task_tags
  ALTER COLUMN user_id SET NOT NULL;

-- Keep id unique
ALTER TABLE public.task_tags ADD CONSTRAINT task_tags_id_unique UNIQUE (id);

-- Auto-populate user_id on insert
CREATE OR REPLACE FUNCTION public.set_task_tag_user_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id := (SELECT user_id FROM public.ideas WHERE id = NEW.idea_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_tags_set_user_id
  BEFORE INSERT ON public.task_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_task_tag_user_id();
