# Balanced Work Life — Project Context

## Overview

A productivity app (React/Next.js + PowerSync/Supabase) for task planning with a focus on life-area balance. Users capture ideas/tasks, schedule them, organize by life area (work, health, relationships, growth, finances, life), and visualize balance via a donut ring. It has a Brainstorm view for hierarchical idea trees with dependency links (graph view).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI/Styling | Tailwind CSS v4 (`@import "tailwindcss"` with `@theme inline` directive) |
| Animation | Framer Motion 12 |
| Icons | Lucide React 1 (stroke-based, consistent weight) |
| Font | Plus Jakarta Sans (via `next/font/google`) |
| Backend | Supabase (Postgres + Auth) |
| Sync | PowerSync (Web + React) |
| Graph | @xyflow/react (React Flow) + dagre |
| Auth | Supabase Auth (via `@supabase/auth-helpers-nextjs`) |
| Charts | Recharts (used by BalanceRing via SVG) |
| Package Manager | pnpm 10 |

---

## Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout — font, background mesh, Providers
│   ├── globals.css               # Tailwind import, glass classes, mesh, scrollbar
│   ├── page.tsx                  # / — Today view (grouped tasks + BalanceRing)
│   ├── timeline/page.tsx         # /timeline — scrollable day cards, Focus mode
│   ├── brainstorm/page.tsx       # /brainstorm — IdeaTree & GraphView
│   ├── backup/page.tsx           # /backup — import/export JSON
│   └── login/                    # Auth pages
│
├── components/
│   ├── AppShell.tsx              # Shared layout: sidebar + header + main + mobile nav
│   ├── DesktopSidebar.tsx        # 220px glass sidebar + Lucide icons + layoutId animation
│   ├── Navigation.tsx            # Mobile bottom nav bar
│   ├── BalanceRing.tsx           # Donut chart for area balance
│   ├── QuickAddButton.tsx        # FAB + modal for quick task capture
│   └── brainstorm/
│       ├── IdeaNode.tsx          # Recursive tree node (Lucide icons, drag/drop)
│       ├── IdeaTree.tsx          # Full tree container
│       ├── GraphView.tsx         # React Flow graph canvas
│       ├── GraphIdeaNode.tsx     # Custom node renderer for graph
│       ├── IdeaComposer.tsx      # Inline child creation input
│       ├── AreaPicker.tsx        # Life area dropdown
│       ├── TypePicker.tsx        # Idea type dropdown
│       ├── SchedulePicker.tsx    # Date picker for scheduling
│       ├── LinkPanel.tsx         # Link/unlink ideas panel (Lucide icons)
│       ├── MoveIdeaPanel.tsx     # Move idea between parents
│       └── IdeaSearchPicker.tsx  # Searchable idea selector
│
├── hooks/
│   ├── useAuth.tsx               # Supabase auth context + sign out
│   ├── useIdeas.ts               # CRUD for ideas table (optimistic updates)
│   └── useIdeaLinks.ts           # CRUD for idea_links table
│
├── lib/
│   ├── types.ts                  # Idea, IdeaLink, IdeaNode, LifeArea, etc.
│   ├── navItems.ts               # Route config with Lucide icons
│   ├── dateUtils.ts              # getToday, formatDate, getDatesRange, etc.
│   ├── supabase.ts               # Supabase client
│   └── powersync.ts              # PowerSync client
│
└── styles/
    └── tokens.ts                 # Design token constants (glass, radius, area colors, typography)
```

---

## Data Model

Single `ideas` table (Supabase), polymorphic — used for tasks, ideas, objectives, projects, initiatives.

### Idea Fields

| Field | Type | Purpose |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to auth.users |
| `parent_id` | `uuid?` | Hierarchical parent (for tree) |
| `text` | `string` | Content |
| `type` | `"idea" \| "objective" \| "project" \| "initiative" \| "task"` | Type tag |
| `area` | `"work" \| "health" \| "relationships" \| "growth" \| "finances" \| "life"` | Life area |
| `scheduled_date` | `date?` | Day task is assigned to |
| `scheduled_time` | `time?` | Optional time block |
| `duration_minutes` | `int?` | Estimated duration |
| `is_priority` | `bool` | Top priority for the day |
| `priority_order` | `int?` | Order within priorities |
| `status` | `"inbox" \| "scheduled" \| "completed" \| "archived"` | Lifecycle state |
| `done_at` | `timestamp?` | Completion timestamp |
| `sort_order` | `int` | Position within parent |
| `notes` | `text?` | Free-text notes |
| `effort` / `impact` / `urgency` | `int?` | Eisenhower matrix (Brainstorm) |

### IdeaLink Fields (separate table)

| Field | Type | Purpose |
|---|---|---|
| `id` | `uuid` | Primary key |
| `source_id` / `target_id` | `uuid` | Link endpoints |
| `link_type` | `"unblocks" \| "contributes_to" \| "depends_on" \| "related_to" \| "part_of"` | Relationship type |

---

## Routes

| Route | Page | Description |
|---|---|---|
| `/` | Today | Tasks grouped by schedule (Today/Tomorrow/This week/Later/Unscheduled), BalanceRing, completed today list |
| `/timeline` | Timeline | Scrollable day cards (past → future), inline add per day, Focus mode (priorities + schedule grid), inbox section |
| `/brainstorm` | Brainstorm | Hierarchical idea tree (expand/collapse, drag/drop, type/area tags) or graph view (React Flow) |
| `/backup` | Backup | Export/import all ideas and links as JSON |
| `/login` | Login | Supabase auth |

---

## Architecture & Design

### State Management
- No global state library — each page calls `useIdeas()` / `useIdeaLinks()` which fetch from Supabase on mount
- Optimistic updates: on create/update/delete, local state updates immediately, then Supabase call fire-and-forget
- Auth state via React context (`useAuth`)

### Visual Design (Current — Glassmorphism)

```
Background:    #f8f7fc with 3 radial-gradient blobs (violet, indigo, sky) blurred and fixed
Surfaces:      rgba(255,255,255,0.7) + backdrop-filter: blur(20px) + 20px border-radius
Sidebar:       220px wide, glass panel, violet accent bar for active nav
Today card:    Slightly stronger shadow + violet border tint
Typography:    Plus Jakarta Sans (regular 400, medium 500, bold 700)
Area tags:     Pill badges, 10px semibold, color-coded rgba backgrounds
Checkboxes:    Custom 18px circle, violet fill on completion, spring animation
Animations:    Framer Motion — stagger mount (day cards), spring (check fill), layoutId (sidebar nav)
```

### CSS Class Utilities (globals.css)

| Class | Purpose |
|---|---|
| `.glass-card` | Standard glass surface |
| `.glass-card-strong` | More opaque glass (header, modals) |
| `.glass-card-today` | Today highlight (violet tint) |
| `.glass-sidebar` | Sidebar glass panel |
| `.focus-button` | Pill button with hover scale |
| `.task-input-wrapper` | Underline animation on focus |

### Design Tokens (src/styles/tokens.ts)

```typescript
radius:   { card: 20, sidebar: 28, pill: 9999, sm: 12 }
glass:    { light/dark: background, backdropFilter, border, shadow }
areaColors: { life, work, finances, relationships, health, growth } with { bg, text, dot }
typography: { body, taskTitle, dayHeader, dayLabel, areaTag, wordmark, subtitle }
```

### Key Component Behaviors (unchanged)
- **TaskRow**: Checkbox toggles done/undone, star toggles priority, area pill opens AreaPicker, ⋯ opens context menu (move to today/pick date/backlog/archive)
- **Day cards**: Tap "Focus" to expand priorities + schedule grid; past-due tasks show "unresolved" badge
- **QuickAddButton**: FAB at bottom-right opens modal with text, when (today/tomorrow/custom/none), area
- **Brainstorm**: Tree nodes support inline edit (click text), drag/drop reorder, collapse/expand, type/area pills, link count badge, action buttons (link/move/schedule/delete)
