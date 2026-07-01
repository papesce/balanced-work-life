-- Tags: user-created labels, each assigned to exactly one Area
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  area text NOT NULL CHECK (area IN ('work','health','relationships','growth','finances','life')),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_tags_user ON public.tags(user_id);

-- Join table: many-to-many between ideas and tags
CREATE TABLE public.task_tags (
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);

ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their task_tags" ON public.task_tags
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM public.ideas WHERE id = idea_id)
  );

CREATE INDEX idx_task_tags_idea ON public.task_tags(idea_id);
CREATE INDEX idx_task_tags_tag ON public.task_tags(tag_id);
