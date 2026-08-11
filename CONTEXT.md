# CONTEXT.md — balanced-work-life

## Project Overview
- A personal productivity PWA for tracking tasks, ideas, and projects across life areas (work, health, relationships, growth, finances, life). Combines a daily planner, multi-day timeline, horizon planning, and life-balance visualizations in one app.
- Single-user (auth required); built for personal use by the repo owner.
- Currently at version `0.2.3`; git branch `main` (8 commits ahead of `origin/main`, working tree clean).
- Changesets workflow active — 4 pending changesets (2 minor, 2 patch) for: multi-select tag/area picker, planner timeline navigation + reschedule options, toolbar/header unify + backup-into-UserMenu, timeline range filters + triage.

---

## Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.11 |
| Language | TypeScript | 5 (strict) |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS v4 (CSS-first, no tailwind.config) | 4 |
| Database | Supabase (Postgres + Auth + RLS) | @supabase/supabase-js ^2.106 |
| Sync (configured, not active in hooks) | PowerSync | @powersync/web ^1.38 |
| Timeline component | @papesce/dayslot (own published package) | ^0.6.2 |
| Animations | Framer Motion | ^12.40 |
| Icons | Lucide React | ^1.17 |
| Graph view | @xyflow/react + dagre | ^12.10 / ^0.8 |
| Charts | Recharts | ^3.8 |
| Package manager | pnpm | 10.25 |
| Versioning | Changesets | ^2.31 |
| Deployment | Docker → Google Cloud Run (standalone output) | — |

**Key library notes:**
- `@papesce/dayslot` — own published drag-and-drop daily timeline component (`DailyTimeline`), vendored as a dependency; wrapped by `src/components/planner/DayslotTimeline.tsx`
- `@xyflow/react` + `dagre` — powers the brainstorm graph node view
- `framer-motion` — sidebar transitions, card animations, page/view transitions
- `@powersync/web` — schema + connector defined in `src/lib/powersync.ts`, but hooks still query Supabase directly (offline sync not yet wired up)

---

## Architecture

### Folder structure
```
src/
  app/                    Next.js App Router pages
    page.tsx              Home → Daily Planner (spans task list + schedule + backlog + balance ring)
    timeline/page.tsx     Timeline — multi-day range view w/ deferred filter + triage
    horizon/page.tsx      Horizon — short/medium/long-term planning columns
    balance/page.tsx      Balance ("Life Compass") — day/week/month/year windows
    brainstorm/page.tsx   Brainstorm + idea graph (hidden from nav, still routable)
    settings/tags/page.tsx Tag management
    login/page.tsx        Auth
    api/shutdown/route.ts Logout/clear-data endpoint (Clear-Site-Data)
    layout.tsx            Root layout (fonts, metadata, PWA meta)
    providers.tsx         AuthProvider + AuthGuard + SW registration
    globals.css           Tailwind v4 @theme + glass-morphism CSS classes
  components/
    AppShell.tsx          Outer layout shell (sidebar + nav + header)
    DesktopSidebar.tsx    Left fixed sidebar
    Navigation.tsx        Mobile bottom nav
    BalanceRing.tsx       SVG donut — area task balance visualization
    MiniBalanceBar.tsx    Compact balance bar for timeline cards (segments by task minutes)
    QuickAddButton.tsx    Floating mobile quick-add
    UserMenu.tsx          Account menu — export/import backup, sign out (replaced /backup page)
    balance/              10 components (DayCalendarView, WeekRingView, MonthRingView, YearWheelView, LifeCompassRadar, BalanceTimelineChart, MiniRing, pickers, toggle)
    brainstorm/           12 components (IdeaTree, IdeaNode, GraphView, pickers/panels, etc.)
    planner/              AreaFilters, AreaTaskGroup, BacklogCard, DateNav, DayslotTimeline, dayslotAdapter, plannerUtils
    shared/               InboxPanel, JumpToTodayButton, TagPicker, UndoBar
    timeline/             DayTaskList, FloatingAddButton, QuickAddInput, timelineUtils
    triage/               TriageActions (reschedule/complete/cancel for deferred rows)
  hooks/
    useAuth.tsx           AuthContext (only global context)
    useIdeas.ts           Core CRUD, tree building, sort/reorder, restore (backup import)
    useIdeaLinks.ts       Brainstorm graph edge CRUD + restore
    useTags.ts            Tag CRUD
    useTaskTags.ts        Idea↔tag join table operations
    useBalanceData.ts     Balance page data (aggregates per window)
    useCalendarData.ts    Calendar/occurrence data for planner
    useWeekData.ts        Week-level aggregation
  lib/
    supabase.ts           Supabase client singleton
    powersync.ts          WASQLite schema + SupabaseConnector (offline-sync plumbing)
    types.ts              All shared TypeScript types and enums
    constants.ts          AREA_* config, STATUS_CONFIG, DEFAULT_TARGETS, SCHEDULE_HOURS
    dateUtils.ts          Date helpers incl. WindowType / getWindowRange / getWindowBuckets / offsetWindow
    navItems.ts           Shared nav config
    backup.ts             buildBackupData / parseBackupFile / downloadBackup
    taskTags.ts           Tag→task helpers
    tasks/rescheduleTask.ts  computeReschedulePatch, getDayOccurrences, DayOccurrence, RescheduleAction, getTriageMeta
    tasks/undo.ts         useUndoAction — undo/redo bar state
    version.ts            APP_VERSION from package.json
  styles/
    tokens.ts             Design tokens: radius, glass, areaColors, typography
supabase/
  migrations/             14 SQL migration files (chronological)
```

### Data flow
```
User action
  → Page component (holds hook instances)
    → Feature hook (useIdeas, useTags, etc.)
      → Optimistic local state update (immediate UI)
      → Supabase JS client (async network call)
        → Supabase Postgres (RLS: auth.uid() = user_id)
      → Rollback on error
```

### State management
- **No Zustand/Redux.** Entirely React `useState`/`useCallback` + one global Context.
- `AuthContext` (via `useAuth.tsx`) is the only React context; everything else is instantiated per-page and prop-drilled.
- Optimistic updates in all write hooks; local state reverts on Supabase error.
- LocalStorage keys: `brainstorm-tree-overrides`, `daily-planner-area-targets`, `planner-right-col-width`, `timeline-prefs`.
- Undo system: `src/lib/tasks/undo.ts` `useUndoAction` registers reverse actions (e.g. task delete, cancel) and renders an `UndoBar`.

### Routing
| Route | Page | In nav |
|---|---|---|
| `/` | Daily Planner (home) | ✅ |
| `/timeline` | Timeline — multi-day range + deferred review | ✅ |
| `/horizon` | Horizon — short/medium/long-term columns | ✅ |
| `/balance` | Balance / Life Compass — day/week/month/year | ✅ |
| `/settings/tags` | Tag management | ✅ |
| `/brainstorm` | Idea tree + graph view | ❌ (hidden from nav, still accessible by URL) |
| `/login` | Auth (email/password + Google OAuth) | — |
| `/api/shutdown` | POST — clears site data on logout | — |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/types.ts` | All types: `Idea`, `Tag`, `TaskTag`, `IdeaLink`, enums (`IdeaType`, `LifeArea`, `IdeaStatus` incl. `deferred`, `IdeaHorizon`, `LinkType`), `getAreasForIdea()`, `getPrimaryTagForIdea()` |
| `src/lib/constants.ts` | `AREA_ORDER/LABELS/ICONS/DOT_COLORS/TEXT_COLORS`, `STATUS_CONFIG`, `DEFAULT_TARGETS`, `SCHEDULE_HOURS` |
| `src/lib/supabase.ts` | Supabase client (reads `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`) |
| `src/lib/powersync.ts` | PowerSync schema + SupabaseConnector (offline sync, not yet used by hooks) |
| `src/hooks/useIdeas.ts` | Core data hook — CRUD, tree building, sort/reorder, restore |
| `src/hooks/useAuth.tsx` | AuthContext provider + guard; Google OAuth + email auth |
| `src/app/page.tsx` | Daily Planner — owns all hooks/state; 3-column layout (ring+areas / tasks / schedule+backlog) |
| `src/app/timeline/page.tsx` | Timeline — anchor date, past/future range filters, deferred filter, triage, per-task "go to date" |
| `src/app/balance/page.tsx` | Life Compass — window toggle (day/week/month/year) driven by URL params |
| `src/app/globals.css` | Tailwind v4 `@theme` config + `.glass-card`, `.toolbar-btn`, `.highlight-pulse`, etc. |
| `src/styles/tokens.ts` | Design tokens: `areaColors`, `areaDarkColors`, glass surfaces, typography |
| `src/components/planner/DayslotTimeline.tsx` | Wraps `@papesce/dayslot` `DailyTimeline` for the schedule view |
| `src/lib/tasks/rescheduleTask.ts` | Deferred/triage logic — reschedule patches, day occurrences, attempt dates |
| `src/lib/backup.ts` | Backup export/import (used by `UserMenu`) |
| `supabase/migrations/` | 14 SQL files; latest: `20260719000000_add_attempt_dates_and_deferred.sql` |
| `src/app/providers.tsx` | `AuthProvider` + `AuthGuard` + service worker registration |

---

## Conventions

### Naming
- Files: PascalCase for components (`IdeaNode.tsx`), camelCase for hooks/lib (`useIdeas.ts`, `dateUtils.ts`)
- React components: PascalCase, one component per file
- Hooks: `use*` prefix, live in `src/hooks/`
- Types: PascalCase interfaces/types in `src/lib/types.ts` — no co-located type files
- DB columns: `snake_case`; TS interfaces mirror DB column names directly

### Component patterns
- Pages own hook instances and pass handlers/data as props (no context for feature state)
- Components are functional, no class components
- Tailwind utility classes for layout/spacing; CSS classes (`.glass-card`, etc.) for visual surfaces
- `framer-motion` for transitions; direct Tailwind for static styles
- Area colors come from `tokens.ts` `areaColors`/`areaDarkColors` maps keyed by `LifeArea`

### Styling
- Tailwind v4: configuration lives in `globals.css` `@theme {}` block, not `tailwind.config.js`
- Glass-morphism surfaces: `.glass-card`, `.glass-card-strong`, `.glass-sidebar`, `.glass-card-anchor` (selected anchor day), `.glass-card-today` — dark-mode variants included
- Toolbar buttons: `.toolbar-btn`, `.toolbar-btn--accent`, `.toolbar-btn--latched`
- Focus/interaction helpers: `.focus-button`, `.highlight-pulse` (task reveal animation)
- Font: Plus Jakarta Sans (Google Fonts, loaded in `layout.tsx`)
- No CSS modules; no styled-components

### Linting / formatting
- ESLint: `next/core-web-vitals` + TypeScript rules (`eslint.config.mjs`)
- Prettier: `.prettierrc.json` + `prettier-plugin-tailwindcss`
- Strict TypeScript mode enabled
- No test suite

---

## Current State

### Fully working
- **Daily Planner** (`/`): date picker, area-grouped task lists, drag reorder, quick add, Smart Sort, hourly schedule via `@papesce/dayslot`, backlog inbox, deferred-on-date section, resizable right column, area targets + balance ring, multi-select tag/area picker (tasks must keep ≥1 area)
- **Timeline** (`/timeline`): multi-day cards with anchor date in URL, past/future range filters with counts, All/Deferred filter, task triage (retry/reschedule/defer/complete/cancel), undo, MiniBalanceBar per day, per-task "go to date" navigation
- **Horizon** (`/horizon`): short/medium/long-term columns, priority star, quick add, parent/type badges
- **Balance / Life Compass** (`/balance`): day (calendar), week, month, year windows — ring/wheel/radar/chart visualizations, window+date in URL, Jump to Today
- **Brainstorm** (`/brainstorm`): idea tree (hierarchy), graph view (xyflow), links between ideas — full CRUD still active but hidden from nav
- **Auth**: email/password + Google OAuth, session management, auth guard
- **Tags system**: replaces old `area` column; `tags` + `task_tags` tables; `TagPicker` shared across views; system tags auto-created per area
- **Deferred/triage**: `attempt_dates` tracking, deferred status, day occurrences, reschedule actions
- **Backup**: export/import JSON via `UserMenu` (downloadable file; import restores ideas + links)
- **Balance visualization**: `BalanceRing`, `MiniBalanceBar` (segments computed by task minutes), `LifeCompassRadar`
- **PWA**: service worker, manifest, installable on mobile
- **Dev tooling**: `scripts/ctl.sh` manages a background dev/prod server on port 4327 (`pnpm balance:open` etc.)

### In progress / half-built
- **PowerSync offline sync**: Schema and connector fully defined in `src/lib/powersync.ts`, but hooks still call Supabase directly — PowerSync is not yet wired into any hook
- **Horizon page**: priority star and item detail are stubbed with `console.log`; only quick-add + column list wired
- **Brainstorm**: hidden from navigation (commit 60a2829); status/pickers were built recently (`feat/planned-status-and-brainstorm-status-picker` branch work merged in) — likely an active work area to unhide/polish

### Known tech debt / issues
- Hook instances are created per-page and prop-drilled; as features grow this becomes unwieldy (no shared feature context or store)
- `LifeArea` enum is still used in several components and `getAreasForIdea()` bridges tags → areas — dual system in transition
- PowerSync `uploadData()` in `powersync.ts` handles CRUD for ideas/tags/task_tags, but this code path is never executed since hooks bypass PowerSync
- Horizon page has placeholder handlers (`console.log` for priority toggle / item navigation)
- No test suite
- 4 pending changesets not yet versioned/released

---

## UI / Design System

### Approach
Tailwind v4 (CSS-first) + custom glass-morphism CSS classes. No component library (no shadcn, no MUI, no Radix).

### Design tokens (`src/styles/tokens.ts`)
```ts
areaColors: Record<LifeArea, string>       // light mode bg colors per area
areaDarkColors: Record<LifeArea, string>   // dark mode bg colors per area
glass: { card, cardStrong, sidebar }       // CSS class strings
typography: { heading, subheading, body, caption }
radius: { sm, md, lg, xl, full }
```

### Glass-morphism classes (defined in `globals.css`)
| Class | Use |
|---|---|
| `.glass-card` | Standard card surface (backdrop blur, translucent bg) |
| `.glass-card-strong` | Higher opacity variant for focused cards / dropdowns |
| `.glass-sidebar` | Sidebar surface |
| `.glass-card-anchor` | Highlighted anchor (selected) day card in timeline |
| `.glass-card-today` | Highlighted today card (distinct color) |

All have dark-mode overrides via `.dark` prefix. Toolbar + focus + pulse helpers are also defined here.

### Icons
Lucide React — used consistently throughout. No other icon set.

### Animations
Framer Motion for sidebar expand/collapse, card transitions, page/view cross-fades. CSS transitions for hover states.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL       Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  Supabase anon (public) key
NEXT_PUBLIC_POWERSYNC_URL      PowerSync instance URL (required even if offline sync unused)
```

---

## Database Schema (current state)

### `ideas` table (core table — everything is an idea)
`id`, `user_id`, `parent_id` (self-ref tree), `text`, `type` (`idea|objective|project|initiative|task`), `sort_order`, `effort`, `impact`, `urgency`, `scheduled_date`, `scheduled_time`, `duration_minutes`, `is_priority`, `priority_order`, `status` (`inbox|planned|scheduled|in_progress|paused|completed|cancelled|archived|deferred`), `notes`, `completed_at`, `cancelled_at`, `paused_at`, `attempt_dates` (string[] — history of rescheduled dates), `horizon` (`short|medium|long|null`), `created_at`, `updated_at`

### `tags` table
`id`, `user_id`, `name`, `area` (LifeArea | null), `is_system` (bool — system tags created per area), `created_at`

### `task_tags` table (many-to-many)
`idea_id`, `tag_id`, `created_at`

### `idea_links` table (brainstorm graph edges)
`id`, `user_id`, `source_id`, `target_id`, `link_type` (`unblocks|contributes_to|depends_on|related_to|part_of`), `created_at`

All tables: RLS enabled, `auth.uid() = user_id`.

### Migrations (14, chronological)
`20250501000000_create_tasks` → `20250501000001_create_ideas` → `20250525000000_create_idea_links` → `20250525000001_add_idea_scores` → `20250525000002_add_idea_id_to_tasks` → `20260527000000_add_idea_scheduling` → `20260528000000_drop_tasks_table` → `20260606000000_update_ideas_for_timeline` → `20260619000000_add_expressive_status` → `20260619000001_add_planned_status` → `20260630000000_create_tags_system` → `20260630000001_migrate_area_to_tags` → `20260709000000_add_horizon_to_ideas` → `20260719000000_add_attempt_dates_and_deferred`

---

## Stale docs (should be reconciled)
- `README.md` is out of date: describes the old time-bucket planner, a `/archive` view, and "offline-first" as delivered — none exist today. Real setup (env vars, `pnpm dev`, background server scripts) is accurate.
- `CLAUDE.md` lists `/deferred` and `/backup` routes that no longer exist (deferred moved into Timeline + planner; backup is in `UserMenu`).
