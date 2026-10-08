-- Horizon lens configuration: user-saved views + per-user prefs (default
-- view/lens, secondary-split map). Synced via PowerSync; replaces the
-- legacy localStorage keys horizon-views-v1, horizon-default-view-id,
-- horizon-active-view-id and horizon-secondary-map (imported client-side once).
--
-- JSON payloads (splits, secondary_map) are TEXT, not jsonb: PowerSync
-- stores/downloads them as strings and the client parses defensively,
-- avoiding the double-encoding problem seen with jsonb columns.

CREATE TABLE public.horizon_views (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  primary_scheme text NOT NULL,
  splits text NOT NULL DEFAULT '{}',
  sort_by text NOT NULL DEFAULT 'manual' CHECK (sort_by IN ('manual', 'priority')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.horizon_prefs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  default_view_id text,
  default_lens_id text,
  secondary_map text NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.horizon_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their horizon_views" ON public.horizon_views
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.horizon_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their horizon_prefs" ON public.horizon_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_horizon_views_user ON public.horizon_views(user_id);
CREATE INDEX idx_horizon_prefs_user ON public.horizon_prefs(user_id);
