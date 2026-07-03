# VF ERP System

Custom ERP for vosFoyer — a 360° creative agency. Built to unify client relationship management, business development pipeline, and retention analytics in a single internal tool.

---

## What This Is

A CRM + BizDev pipeline system adapted from Odoo and Lark Suite patterns, purpose-built for agency workflows:

- **Client CRM** — 360° client view, health scoring, contact management
- **Sales Pipeline** — Kanban/list/calendar views, weighted forecast, stage probability
- **Activity Discipline** — Next-action tracking per deal, overdue alerts, My Activities inbox
- **Chatter** — Per-record comment timeline with @mentions and field history
- **Retention Engine** — T-60/T-30 renewal alerts, client health score (weekly cron), escalation to directors
- **Dashboard** — KPI cards, revenue vs target, expiring contracts, pipeline coverage ratio
- **Analytics** — Win rate by AE/industry, revenue trend 12M, pipeline funnel, AE performance

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
git clone https://github.com/williamsudhana/VF-ERP.git
cd "VF ERP System/execution"
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

# Cron security (generate any random secret, use same value in Vercel env)
CRON_SECRET="your-random-secret-string"
```

Find your keys in: **Supabase Dashboard → Project Settings → API**.

### 4. Run database migrations

```bash
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

Available roles: `admin`, `commercial_director`, `account` (AE), `operation`, `hr`, `finance`.

---

## Deployment to Vercel

```bash
# From repo root (not inside /execution)
npx vercel deploy --prod
```

Add all `.env.local` variables to **Vercel → Project Settings → Environment Variables**.

`vercel.json` already configures two cron jobs:
- `/api/cron/alerts` — daily 02:00 UTC (T-60/T-30 renewal alerts)
- `/api/cron/health` — weekly Monday 03:00 UTC (client health score)

Set `CRON_SECRET` in Vercel env vars (same value as local `.env.local`).

---

## Database

**The database is NOT included in this repo.**

This repo contains:
- `prisma/schema.prisma` — schema definition
- `prisma/migrations/` — versioned SQL migration files

Your data lives entirely in your own Supabase project. Nothing is shared between deployments.

---

## Project Structure

```
VF ERP System/
├── execution/              # Next.js app (the thing you deploy)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/     # versioned migration SQL files
│   ├── src/
│   │   ├── app/            # App Router pages + API routes
│   │   ├── components/     # UI components
│   │   └── lib/            # Utilities, validations, config
│   ├── scripts/            # One-off data import scripts
│   └── vercel.json         # Cron job config
├── directives/             # Agent SOPs (internal)
└── outputs/                # Generated artifacts (internal)
```

---

## Customizing for Your Agency

| What | Where |
|------|-------|
| User roles | `Role` enum in `prisma/schema.prisma` → `npx prisma migrate dev` |
| Pipeline stages | `PipelineStage` enum in schema (hardcoded for type safety); per-stage probability/color editable via `/settings` UI |
| Industry / org size options | `Industry` and `OrgSize` enums in schema |
| Health score weights | `src/lib/health-score.ts` (pure functions, no DB) |
| Alert timing (T-60/T-30) | `src/app/api/cron/alerts/route.ts` |
| Email templates | Supabase Dashboard → Authentication → Email Templates |

---

## Running Tests

```bash
# Unit + integration tests (Vitest)
npm test

# E2E smoke tests (Playwright) — requires dev server running
npm run test:e2e
```

---

## Known Limitations

- Health score is a proxy model (v1) using activity recency + revenue trend signals; labeled as such in the UI
- Cold-start guard: health score skips status changes for clients with zero activity history, preventing overwrites of manually-set statuses on first run
- Mobile: activity-first layout; kanban uses horizontal scroll on small screens
- Cron jobs require Vercel Pro or higher for schedules under 24h (the daily alerts cron needs Pro)
