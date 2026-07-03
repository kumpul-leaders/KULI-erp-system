# Open ERP

An open-source CRM + BizDev pipeline system built with Next.js, Supabase, and Prisma. Self-host it for your team in under 30 minutes.

Adapted from Odoo and Lark Suite patterns — designed for teams that need sales pipeline management, client health tracking, and renewal automation without paying for a SaaS tool.

---

## Features

- **Client CRM** — 360° client view, health scoring, contact management
- **Sales Pipeline** — Kanban/list/calendar views, weighted forecast, stage probability
- **Activity Discipline** — Next-action tracking per deal, overdue alerts, My Activities inbox
- **Chatter** — Per-record comment timeline with @mentions and field history
- **Retention Engine** — T-60/T-30 renewal alerts, client health score (automated weekly), escalation rules
- **Dashboard** — KPI cards, revenue vs target, expiring contracts, pipeline coverage ratio
- **Analytics** — Win rate by rep/industry, revenue trend 12M, pipeline funnel, rep performance

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Auth | Supabase Auth (email + role-based) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Hosting | Vercel (cron jobs included) |
| Storage | Supabase Storage (private bucket, signed URLs) |

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account (for deployment + cron jobs)

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/williamsudhana/open-erp.git
cd open-erp/execution
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create `execution/.env` (for Prisma CLI):

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

Create `execution/.env.local` (for Next.js runtime):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Database (same as .env above)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Cron security — generate any random string, use same value in Vercel env vars
CRON_SECRET="your-random-secret-string"
```

Find your keys in: **Supabase Dashboard → Project Settings → API**.

### 4. Run database migrations

```bash
cd execution
npx prisma migrate deploy
npx prisma generate
```

This applies all migrations in order — no manual SQL needed.

### 5. Set up Supabase Storage

In Supabase Dashboard → Storage:
1. Create a bucket named `pipeline-docs`
2. Set it to **Private** (not public)

Uploads go through the server using the service role key — no additional RLS policies needed.

### 6. Start dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## First Login

Supabase Auth handles authentication. To create your first admin user:

1. Go to **Supabase Dashboard → Authentication → Users → Invite User**
2. Enter your email → send invite
3. Click the link in the email → set your password
4. Log in at `http://localhost:3000`
5. In **Supabase Dashboard → Table Editor → `users` table** → set your `role` to `admin`

Available roles: `admin`, `commercial_director`, `account` (sales rep), `operation`, `hr`, `finance`.

---

## Deployment to Vercel

```bash
# From repo root
npx vercel deploy --prod
```

Add all `.env.local` variables to **Vercel → Project Settings → Environment Variables**.

`vercel.json` already configures two automated cron jobs:
- `/api/cron/alerts` — runs daily at 02:00 UTC (T-60/T-30 renewal alerts)
- `/api/cron/health` — runs every Monday at 03:00 UTC (client health score update)

Set `CRON_SECRET` in Vercel env vars — must match the value in `.env.local`.

> **Note:** Daily cron jobs require Vercel Pro or higher.

---

## Database

**The database is NOT included in this repo.**

This repo contains:
- `execution/prisma/schema.prisma` — schema definition
- `execution/prisma/migrations/` — versioned SQL migration files

Your data lives entirely in your own Supabase project. Each deployment is fully isolated.

---

## Project Structure

```
open-erp/
└── execution/              # Next.js app (the thing you deploy)
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/     # versioned migration SQL files
    ├── src/
    │   ├── app/            # App Router pages + API routes
    │   ├── components/     # UI components
    │   └── lib/            # Utilities, validations, config
    ├── scripts/            # One-off data import/seed scripts
    └── vercel.json         # Cron job config
```

---

## Customizing for Your Team

| What | Where |
|------|-------|
| App name / branding | `src/app/layout.tsx`, `src/components/layout/sidebar.tsx`, auth pages |
| User roles | `Role` enum in `prisma/schema.prisma` → `npx prisma migrate dev` |
| Pipeline stages | `PipelineStage` enum in schema; per-stage probability/color editable via `/settings` UI |
| Industry / company size options | `Industry` and `OrgSize` enums in schema |
| Health score weights | `src/lib/health-score.ts` (pure functions, no DB) |
| Alert timing (T-60/T-30) | `src/app/api/cron/alerts/route.ts` |
| Email templates | Supabase Dashboard → Authentication → Email Templates |

---

## Running Tests

```bash
cd execution

# Unit + integration tests (Vitest)
npm test

# E2E smoke tests (Playwright) — requires dev server running on :3000
npm run test:e2e
```

---

## Architecture Notes

- **Stage probability** — per-stage config (probability, color, forecast weight) stored in DB via `/settings`, no code change needed to tune
- **Health score** — proxy model v1 using activity recency (35%), renewal proximity (30%), revenue trend (20%), engagement (15%); overridable per client
- **Cold-start guard** — health score skips status updates for clients with zero activity history, preventing overwrites of manually-set statuses on first run
- **Cron idempotency** — renewal alerts use `dedupeKey` unique constraint so re-runs don't create duplicate alerts
- **Storage** — documents stored in private Supabase bucket; 5-minute signed URLs generated server-side on demand

---

## License

MIT
