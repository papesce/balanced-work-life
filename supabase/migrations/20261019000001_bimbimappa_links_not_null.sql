-- Match the BimbiMappa source schema: every place has a links array.
-- The destination is empty at cutover, so this adds no data rewrite.
do $$
begin
  if exists (select 1 from public.places where links is null) then
    raise exception 'Cannot enforce BimbiMappa places.links NOT NULL while null values exist';
  end if;
  alter table public.places alter column links set not null;
end
$$;

