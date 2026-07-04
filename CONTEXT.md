# CONTEXT.md — balanced-work-life

## Project Overview
- A personal productivity PWA for tracking tasks, ideas, and projects across life areas (work, health, relationships, growth, finances, life). Combines a daily planner, timeline view, and brainstorm/idea graph in one app.
- Single-user (auth required); built for personal use by the repo owner.

---

## Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 |
| Language | TypeScript | 5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS v4 (CSS-first, no tailwind.config) | 4 |
| Database | Supabase (Postgres + Auth + RLS) | @supabase/supabase-js ^2.106 |
| Sync (configured, not active in hooks) | PowerSync | @powersync/web ^1.38 |
| Animations | Framer Motion | ^12.40 |
| Icons | Lucide React | ^1.17 |
| Graph view | @xyflow/react + dagre | ^12.10 / ^0.8 |
| Charts | Recharts | ^3.8 |
| Package manager | pnpm | 10.25 |
| Deployment | Docker → Google Cloud Run (standalone output) | — |

**Key library notes:**
- `@xyflow/react` — powers the brainstorm graph node view
- `dagre` — auto-layout for graph nodes
- `framer-motion` — sidebar transitions, card animations
- `@powersync/web` — schema + connector defined in `src/lib/powersync.ts`, but hooks still query Supabase directly (offline sync not yet wired up)

---

## Architecture

### Folder structure
```
src/
  app/                    Next.js App Router pages
    page.tsx              Home → Daily Planner
    timeline/page.tsx     Timeline view
    brainstorm/page.tsx   Brainstorm + idea graph
    settings/tags/page.tsx Tag management
    login/page.tsx        Auth
    backup/page.tsx       Data backup UI
    layout.tsx            Root layout (fonts, metadata, PWA meta)
    providers.tsx         AuthProvider + AuthGuard + SW registration
    globals.css           Tailwind v4 @theme + glass-morphism CSS classes
  components/
    AppShell.tsx          Outer layout shell (sidebar + nav)
    DesktopSidebar.tsx    Left fixed sidebar
    Navigation.tsx        Mobile bottom nav
    BalanceRing.tsx       SVG donut — area task balance visualization
    MiniBalanceBar.tsx    Compact balance bar for timeline cards
    QuickAddButton.tsx    Floating mobile quick-add
    brainstorm/           8 components (IdeaTree, IdeaNode, GraphView, etc.)
    planner/              6 components (ScheduleGrid, AreaTaskGroup, etc.)
    timeline/             4 components (DayTaskList, QuickAddInput, etc.)
    shared/               TagPicker.tsx (shared across views)
  hooks/
    useAuth.tsx           AuthContext (only global context)
    useIdeas.ts           Full CRUD, tree building, sort, reorder
    useIdeaLinks.ts       Brainstorm graph edge CRUD
    useTags.ts            Tag CRUD
    useTaskTags.ts        Idea↔tag join table operations
  lib/
    supabase.ts           Supabase client singleton
    powersync.ts          WASQLite schema + SupabaseConnector (offline-sync plumbing)
    types.ts              All shared TypeScript types and enums
    dateUtils.ts          Date helpers (getToday, getDatesRange, isPast, etc.)
    navItems.ts           Shared nav config
    version.ts            APP_VERSION from package.json
  styles/
    tokens.ts             Design tokens: radius, glass, areaColors, typography
supabase/
  migrations/             12 SQL migration files (chronological)
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
- LocalStorage: brainstorm tree collapse overrides (`brainstorm-tree-overrides`), area target percentages (`daily-planner-area-targets`).

### Routing
| Route | Page |
|---|---|
| `/` | Daily Planner (home) |
| `/timeline` | Timeline — multi-day task view |
| `/brainstorm` | Idea tree + graph view |
| `/settings/tags` | Tag management |
| `/login` | Auth (email/password + Google OAuth) |
| `/backup` | Data export/backup |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/types.ts` | All types: `Idea`, `Tag`, `TaskTag`, `IdeaLink`, enums (`IdeaType`, `LifeArea`, `IdeaStatus`, `LinkType`) |
| `src/lib/supabase.ts` | Supabase client (reads `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`) |
| `src/lib/powersync.ts` | PowerSync schema + SupabaseConnector (offline sync, not yet used by hooks) |
| `src/hooks/useIdeas.ts` | Core data hook — CRUD, tree building, sort, reorder for the `ideas` table |
| `src/hooks/useAuth.tsx` | AuthContext provider + guard; Google OAuth + email auth |
| `src/app/page.tsx` | Daily Planner page — instantiates all hooks, owns all state |
| `src/app/brainstorm/page.tsx` | Brainstorm page — tree + graph views |
| `src/app/timeline/page.tsx` | Timeline page — multi-day date range task cards |
| `src/app/globals.css` | Tailwind v4 `@theme` config + `.glass-card`, `.glass-sidebar` CSS classes |
| `src/styles/tokens.ts` | Design tokens: `areaColors`, `areaDarkColors`, glass surfaces, typography |
| `src/components/planner/constants.ts` | `AREA_ORDER`, `AREA_LABELS`, `AREA_ICONS`, `DEFAULT_TARGETS` |
| `src/components/planner/plannerUtils.ts` | `offsetDate`, `formatDayLabel`, `formatTime` |
| `src/components/planner/ScheduleGrid.tsx` | Hourly schedule grid in daily planner |
| `supabase/migrations/` | 12 SQL files; latest: `20260630000001_migrate_area_to_tags.sql` |
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
- Glass-morphism surfaces: `.glass-card`, `.glass-card-strong`, `.glass-sidebar`, `.glass-card-today` — defined in `globals.css`, dark-mode variants included
- Font: Plus Jakarta Sans (Google Fonts, loaded in `layout.tsx`)
- No CSS modules; no styled-components

### Linting / formatting
- ESLint: `next/core-web-vitals` + TypeScript rules (`eslint.config.mjs`)
- Prettier: `.prettierrc.json` present (settings not examined)
- Strict TypeScript mode enabled

---

## Current State

### Fully working
- Daily Planner: date picker, area-grouped task lists, schedule grid, drag reorder, quick add
- Timeline: multi-day cards, task status updates, inline editing
- Brainstorm: idea tree (hierarchy), graph view (xyflow), links between ideas
- Auth: email/password + Google OAuth, session management, auth guard
- Tags system: replaces old `area` column; `tags` + `task_tags` tables; `TagPicker` component used across views; system tags auto-created per area
- Balance visualization: `BalanceRing` and `MiniBalanceBar` derived from task counts by area
- PWA: service worker, manifest, installable on mobile

### In progress / half-built
- **PowerSync offline sync**: Schema and connector fully defined in `src/lib/powersync.ts`, but `useIdeas`, `useTags`, etc. still call Supabase directly — PowerSync is not yet wired into any hook
- **Backup page** (`/backup`): exists but extent of functionality unclear

### Known tech debt / issues
- Hook instances are created per-page and prop-drilled; as features grow this becomes unwieldy (no shared feature context or store)
- `area` field was removed from `ideas` table in favor of tags, but `LifeArea` enum is still used in several components and `getAreasForIdea()` bridges tags → areas — dual system in transition
- PowerSync `uploadData()` in `powersync.ts` handles CRUD for ideas/tags/task_tags, but this code path is never executed since hooks bypass PowerSync
- No test suite

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
| `.glass-card-strong` | Higher opacity variant for focused cards |
| `.glass-sidebar` | Sidebar surface |
| `.glass-card-today` | Highlighted today card (distinct color) |

All have dark-mode overrides via `.dark` prefix.

### Icons
Lucide React — used consistently throughout. No other icon set.

### Animations
Framer Motion for sidebar expand/collapse, card transitions. CSS transitions for hover states.

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
`id`, `user_id`, `parent_id` (self-ref tree), `text`, `type` (`idea|objective|project|initiative|task`), `sort_order`, `effort`, `impact`, `urgency`, `scheduled_date`, `scheduled_time`, `duration_minutes`, `is_priority`, `priority_order`, `status` (`inbox|planned|scheduled|in_progress|paused|completed|cancelled|archived`), `notes`, `completed_at`, `cancelled_at`, `paused_at`, `created_at`, `updated_at`

### `tags` table
`id`, `user_id`, `name`, `area` (LifeArea | null), `is_system` (bool — system tags created per area), `created_at`

### `task_tags` table (many-to-many)
`idea_id`, `tag_id`, `created_at`

### `idea_links` table (brainstorm graph edges)
`id`, `user_id`, `source_id`, `target_id`, `link_type` (`unblocks|contributes_to|depends_on|related_to|part_of`), `created_at`

All tables: RLS enabled, `auth.uid() = user_id`.
