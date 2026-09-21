-- Quick Notes: transient scratchpad, one open note per user (enforced in app logic)
CREATE TABLE public.quick_notes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their quick notes" ON public.quick_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_quick_notes_user_status ON public.quick_notes(user_id, status)
  WHERE deleted_at IS NULL;
