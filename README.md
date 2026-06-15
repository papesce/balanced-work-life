# Balanced Work Life

A task planner that helps you maintain balance between work and life. Organize tasks into time buckets (today, tomorrow, next week, backlog), categorize them as "work" or "life", and visualize your balance with charts.

## Tech Stack

- **Next.js** — React framework with App Router
- **Supabase** — Authentication and Postgres database
- **PowerSync** — Offline-first sync engine for real-time local-first data
- **Recharts** — Balance visualization charts
- **Tailwind CSS** — Styling

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [PowerSync](https://www.powersync.com) instance connected to your Supabase database

### Setup

1. Clone the repo and install dependencies:

```bash
pnpm install
```

2. Copy the environment file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
```

3. Run the development server:

```bash
pnpm dev          # plain Next.js dev server
pnpm dev:open     # frees port 3000, starts dev, auto-opens the browser
```

For a background dev server on a bookmark-friendly port:

```bash
pnpm balance:open    # starts if needed and opens http://localhost:4327
pnpm balance:status
pnpm balance:stop
pnpm balance:logs
```

To make the `balance` command available from any terminal:

```bash
pnpm balance:install
```

This installs a symlink at `~/bin/balance` and adds `~/bin` to your shell
`PATH` if needed. Open a new terminal after installing. Then use:

```bash
balance open
balance status
balance stop
```

To remove the command and the managed PATH entry:

```bash
balance uninstall
# or: pnpm balance:uninstall
```

For a production-mode preview (build + start):

```bash
pnpm start:open
pnpm balance:start prod
```

Override the background launcher port with `BALANCE_PORT=4000 pnpm balance:open`.
Override the foreground launcher port with `PORT=4000 pnpm dev:open`.

Open [http://localhost:3000](http://localhost:3000) in your browser (auto-opened by `:open` variants).
The background launcher uses [http://localhost:4327](http://localhost:4327) by default.

## Features

- **Today view** — Focus on what matters now with a balance chart
- **Planner** — Organize tasks across time buckets
- **Archive** — Review completed tasks
- **Offline-first** — Works offline via PowerSync, syncs when connected
- **Auth** — Email/password login via Supabase Auth
