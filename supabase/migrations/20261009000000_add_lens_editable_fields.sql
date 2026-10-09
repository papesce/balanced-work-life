-- Add editable lens fields to horizon_views: description, column_order, tiebreakers, is_builtin
ALTER TABLE public.horizon_views ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE public.horizon_views ADD COLUMN column_order text NOT NULL DEFAULT '[]';
ALTER TABLE public.horizon_views ADD COLUMN tiebreakers text NOT NULL DEFAULT '[]';
ALTER TABLE public.horizon_views ADD COLUMN is_builtin boolean NOT NULL DEFAULT false;