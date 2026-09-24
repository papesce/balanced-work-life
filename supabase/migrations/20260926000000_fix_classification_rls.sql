-- Fix RLS INSERT path (WITH CHECK) for classification + tag tables.
--
-- Root cause: policies declared as `FOR ALL USING (...)` without `WITH CHECK`
-- reject every INSERT with 42501 (new row violates row-level security policy).
-- Postgres governs INSERT solely by WITH CHECK; USING is ignored for inserts.
-- This wedged the PowerSync upload queue on classification_options PUT.
--
-- Also makes the classification_options ownership check null-safe via EXISTS.

-- classification_schemes: own rows by user_id
drop policy if exists "Users own their classification_schemes" on public.classification_schemes;
create policy "Users own their classification_schemes" on public.classification_schemes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- classification_options: owned via parent scheme
drop policy if exists "Users own their classification_options" on public.classification_options;
create policy "Users own their classification_options" on public.classification_options
  for all using (
    exists (
      select 1 from public.classification_schemes s
      where s.id = scheme_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classification_schemes s
      where s.id = scheme_id and s.user_id = auth.uid()
    )
  );

-- idea_classifications: own rows by user_id
drop policy if exists "Users own their idea_classifications" on public.idea_classifications;
create policy "Users own their idea_classifications" on public.idea_classifications
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tags: same missing-WITH-CHECK bug
drop policy if exists "Users own their tags" on public.tags;
create policy "Users own their tags" on public.tags
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- task_tags: now carries user_id (backfilled + trigger-maintained from ideas),
-- so check ownership directly instead of via the ideas subquery.
drop policy if exists "Users own their task_tags" on public.task_tags;
create policy "Users own their task_tags" on public.task_tags
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
