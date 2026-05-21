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
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Today view** — Focus on what matters now with a balance chart
- **Planner** — Organize tasks across time buckets
- **Archive** — Review completed tasks
- **Offline-first** — Works offline via PowerSync, syncs when connected
- **Auth** — Email/password login via Supabase Auth
