# AGENTS.md

Balanced Work Life: a task planner (work/life time buckets, balance charts). Next.js App Router + Supabase (auth, Postgres) + PowerSync (offline-first sync) + Tailwind + Recharts. Package manager is **pnpm**.

## Commands

- `pnpm dev` — Next.js dev server (`pnpm balance:open` runs a background one on port 4327)
- `pnpm test` — node test runner over `src/**/*.test.ts`
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm format:check`
- `pnpm check` — format + lint + tsc + build (run before finishing larger changes)
- `pnpm precommit` — what the git pre-commit hook runs (prettier on staged files, lint, tsc)

## Layout

- `src/app` routes, `src/components` UI by feature, `src/lib` pure logic (with colocated `*.test.ts`), `src/hooks`, `src/contexts`, `src/stores`
- `src/lib/powersyncSchema.ts` and `powersync/sync-config.yaml` define the synced tables; keep them in step with migrations
- `supabase/migrations/` timestamped SQL migrations; after adding or editing one, run `supabase db push`
- Migrations should be idempotent (`do $$ begin ... exception when duplicate_object then null; end $$;`)

## Conventions

- Match surrounding code: naming, comment density, idiom. Put testable logic in `src/lib` with a colocated test.
- Releases use changesets (`pnpm changeset`).
- `public.places`, `public.trips`, the `place-photos` bucket and their policies belong to the separate BimbiMappa app. Do not drop or "clean up" them (see `supabase/migrations/20261019000000_add_bimbimappa_objects.sql`).
- Never commit `.env.local`.

## UI work

For any visual or UI change, follow `docs/AGENTS.md` (design-director guidelines: inspect existing patterns first, reuse design tokens and shared components, decide and implement rather than asking).
