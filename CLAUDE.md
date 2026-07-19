# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version warning

This project uses Next.js 16.2.6. Read `node_modules/next/dist/docs/` before writing any Next.js-specific code — APIs and conventions may differ significantly from training data.

## Commands

```bash
pnpm dev          # start dev server (localhost:3000)
pnpm build        # production build
pnpm lint         # ESLint (next/core-web-vitals + TypeScript rules)
```

No test suite exists.

## Architecture

Personal productivity PWA. Single user, auth required. All data lives in a single Supabase Postgres table (`ideas`) with RLS (`auth.uid() = user_id`).

**Everything is an `Idea`.** Tasks, projects, objectives, initiatives — all rows in `ideas`. The `type` field (`idea | objective | project | initiative | task`) and `status` field distinguish them. The `parent_id` self-reference forms the hierarchy used by the brainstorm tree view.

### Routes

| Route | Description |
|---|---|
| `/` | Daily Planner — area-grouped tasks for a selected date |
| `/timeline` | Multi-day task cards with inline editing |
| `/deferred` | Overdue + deferred tasks with reschedule actions |
| `/horizon` | Short/medium/long-term planning columns |
| `/brainstorm` | Hierarchical idea tree + graph view (xyflow) |
| `/balance` | Life area balance ring visualizations (day/week/month/year) |
| `/settings/tags` | Tag management |
| `/backup` | Data export |

### Data flow

Pages own hook instances and prop-drill — no shared feature state or store. Only `AuthContext` is a React context.

```
User action → Page component (holds hook instances)
  → Feature hook (useIdeas, useTags, etc.)
    → Optimistic local state update
    → Supabase JS client
      → Supabase Postgres (RLS)
    → Rollback on error
```

### Key types (`src/lib/types.ts`)

- `IdeaStatus`: `inbox | planned | scheduled | in_progress | paused | completed | cancelled | archived | deferred`
- `IdeaType`: `idea | objective | project | initiative | task`
- `LifeArea`: `work | health | relationships | growth | finances | life`
- `IdeaHorizon`: `short | medium | long`
- `Idea` includes: `scheduled_date`, `scheduled_time`, `duration_minutes`, `horizon`, `attempt_dates` (string[], records past scheduled dates when a task is rescheduled)

### Tags / areas

The `area` column was removed from `ideas` in favor of a `tags` / `task_tags` many-to-many system. System tags are auto-created per `LifeArea`. `getAreasForIdea(tags)` in `types.ts` bridges tags → areas. Both systems coexist during the transition.

### Deferred tasks (`/deferred`)

When a task misses its scheduled date and is rescheduled, the old date is appended to `attempt_dates`. A task with `status: "deferred"` has no `scheduled_date`. `useDeferredTasks.ts` buckets overdue tasks by age; `src/lib/tasks/rescheduleTask.ts` computes the DB patch for retry/reschedule/defer actions.

### PowerSync (not active)

Schema and `SupabaseConnector` are defined in `src/lib/powersync.ts` but no hook uses PowerSync — all hooks query Supabase directly.

## Styling conventions

- **Tailwind v4**: config lives in `globals.css` `@theme {}` block — no `tailwind.config.js`
- **Glass-morphism surfaces**: use CSS classes `.glass-card`, `.glass-card-strong`, `.glass-sidebar`, `.glass-card-today` (defined in `globals.css`, dark-mode variants included)
- **Area colors**: always source from `src/styles/tokens.ts` `areaColors` / `areaDarkColors` keyed by `LifeArea`
- **No component library** — no shadcn, no MUI, no Radix

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_POWERSYNC_URL
```

## Database migrations

`supabase/migrations/` — apply in filename order. Latest: `20260719000000_add_attempt_dates_and_deferred.sql`.
