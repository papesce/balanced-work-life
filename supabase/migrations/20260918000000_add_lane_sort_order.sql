-- Add sort_order to lane_configs for user-defined lane ordering

alter table public.lane_configs add column if not exists sort_order integer not null default 0;

-- Backfill sort_order based on created_at for existing rows
update public.lane_configs lc
set sort_order = sub.rn
from (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, horizon ORDER BY created_at) - 1 AS rn
  FROM public.lane_configs
) sub
WHERE lc.id = sub.id;

-- Update index to include sort_order for efficient ordered queries
drop index if exists idx_lane_configs_user_horizon;
create index if not exists idx_lane_configs_user_horizon on public.lane_configs(user_id, horizon, sort_order);
