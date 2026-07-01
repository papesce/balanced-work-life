-- Create system tags for every (user, area) pair that exists in ideas
INSERT INTO public.tags (user_id, name, area, is_system)
SELECT DISTINCT user_id, area, area, true
FROM public.ideas
WHERE area IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- Link each idea to its area's system tag via task_tags
INSERT INTO public.task_tags (idea_id, tag_id)
SELECT i.id, t.id
FROM public.ideas i
JOIN public.tags t ON t.user_id = i.user_id AND t.name = i.area AND t.is_system = true
WHERE i.area IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop the now-redundant area column
ALTER TABLE public.ideas DROP COLUMN area;
