# WEBO Build Notes — Phase 2 Batch 4C: Notification UI
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run test`: 122/122 pass. `npm run build`: clean (32/32 routes, /notifications appears as dynamic server-rendered route).

## File Map
| File | Action | Notes |
|------|--------|-------|
| `src/types/notification.ts` | CREATED | Shared `AppNotification`, `NotificationsResponse` types — client-safe, no Prisma |
| `src/lib/utils.ts` | MODIFIED | Added `formatRelativeTime(date)` — Indonesian relative time ("baru saja", "5m lalu", "2j lalu", "kemarin", "3 hari lalu", "2 mgu lalu") |
| `src/components/notifications/notification-bell.tsx` | CREATED | Client component — bell icon with unread badge, Popover preview (10 items), 60s polling + visibilitychange |
| `src/components/notifications/notifications-view.tsx` | CREATED | Client component — full list, unread filter toggle, simple pagination, read-all |
| `src/app/(dashboard)/layout.tsx` | MODIFIED | Added NotificationBell import + absolute overlay on topbar right edge |
| `src/app/(dashboard)/notifications/page.tsx` | CREATED | Server Component page — direct Prisma fetch (no internal HTTP), passes data to NotificationsView |

## Key Decisions

**Bell injection approach — absolute overlay.**
The topbar is a server component and each page renders its own `<Topbar title="...">`. Rather than modifying every page file, the dashboard layout wraps its right panel in a `relative` div and overlays the bell with `absolute` positioning at h-14 (topbar height). The overlay container is `pointer-events-none`; the bell is `pointer-events-auto` — all topbar content behind it remains clickable.

**Polling: `setInterval(60s)` + `visibilitychange`.**
A single polling strategy was chosen (not mixed with window-focus listener). `setInterval(60_000)` for background updates. `document.addEventListener("visibilitychange")` refetches immediately when tab becomes visible. The polling-only call fetches `?limit=1` (minimal payload for badge count only). The full list fetches only when the popover opens.

**Separate notification type.**
Prisma generates its own `NotificationType` enum in `@prisma/client`. A local string union type in `src/types/notification.ts` avoids importing Prisma in client components. The API serializer already outputs plain strings — no runtime conversion needed.

**`/notifications` page uses direct Prisma, not internal fetch.**
Consistent with other Server Component pages (activities, clients, pipeline). Pagination driven by `?page=` URL param; filter toggle driven by `?unread=1`. Both trigger Next.js server re-render. No useEffect-based data fetching.

**Optimistic updates in NotificationsView.**
Mark-read and mark-all-read apply optimistically to local state. API call runs concurrently. On failure: silently ignored (badge/list state is non-critical and refreshes on next poll or page navigation). Keeps the UX snappy.

**Navigation on item click.**
`entityType: "lead"` → `/pipeline/[entityId]`. `entityType: "client"` → `/clients/[entityId]`. Null entity: click marks read but does not navigate. Read items with no entity get `cursor-default` and disabled button state.

---

# WEBO Build Notes — Phase 2 Batch 4B: Chatter UI / RecordTimeline

**Date:** 2026-07-02

## Files Changed

### New
- `src/components/chatter/record-timeline.tsx`

### Modified
- `src/components/pipeline/lead-detail-client.tsx`
- `src/app/(dashboard)/pipeline/[id]/page.tsx`
- `src/app/(dashboard)/clients/[id]/page.tsx`

### Kept but no longer used in pages
- `src/components/pipeline/stage-history-timeline.tsx`
- `src/components/pipeline/field-history-timeline.tsx`

## Key Decisions

**Reuse vs Replace:** Old StageHistoryTimeline/FieldHistoryTimeline kept on disk. RecordTimeline inlines per-kind renderers — required by unified sort.

**Data flow:** fieldHistory + stageHistory from props (server-serialized). Comments/activities/followers fetched client-side on mount.

**Optimistic insert:** Temp comment with `authorId:"__optimistic__"` inserted immediately, replaced on success, rolled back on failure via `deletedAt:"__rollback__"` sentinel.

**Client fieldHistory:** Reshaped `changerName:string` to `changer:{id:"",name}` to match RecordTimeline interface.

**Anchors:** Lead page reuses `id="section-stage-history"` on RecordTimeline wrapper. Client page adds `id="section-client-chatter"` + new Chatter SmartButton.

## Verification
- `npx tsc --noEmit`: 0 errors
- `npm run test`: 122/122 passed
- `npm run build`: clean, 31 pages

---

# WEBO Build Notes — VF ERP Phase 1 Foundation
**Build Date:** 2026-05-18
**Agent:** Webo — Web Engineer & Builder Operations
**Status:** Phase 1 scaffold complete. Build passes. TypeScript: 0 errors.

---

## File Map

### Config & Root
| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js config (unmodified — no customization needed at scaffold) |
| `tsconfig.json` | TypeScript strict mode — generated, unchanged |
| `tailwind.config.ts` | Not created — Tailwind v4 uses CSS-first config in globals.css |
| `components.json` | shadcn/ui config — slate base color, Tailwind v4 compatible |
| `prisma.config.ts` | **Prisma 7 required** — connection URLs moved here from schema.prisma |
| `prisma/schema.prisma` | Full data model: all 9 models, all enums, LeadStageHistory for audit |
| `.env.example` | Template for all required env vars |
| `.env.local` | William fills in Supabase credentials here (gitignored) |

### Source
| File | Purpose |
|------|---------|
| `src/app/globals.css` | Full design system tokens via Tailwind v4 @theme directive |
| `src/app/layout.tsx` | Root layout — Inter font, Sonner toaster |
| `src/app/page.tsx` | Root route — redirects to /dashboard |
| `src/middleware.ts` | Auth guard + /settings admin-only protection |
| `src/types/index.ts` | All domain types: enums, models, UI helpers |
| `src/lib/utils.ts` | cn(), formatIDR(), daysUntil(), contractUrgency(), getInitials() |
| `src/lib/prisma.ts` | Prisma singleton with PrismaPg adapter (Prisma 7) |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client (with cookies) |

### Layout Components
| File | Purpose |
|------|---------|
| `src/components/layout/sidebar.tsx` | Fixed 240px sidebar — nav groups + admin-only section + user info |
| `src/components/layout/topbar.tsx` | 56px header — title + actions slot |
| `src/app/(dashboard)/layout.tsx` | Dashboard shell — auth check + sidebar + main area |

### Pages (all with skeleton placeholders)
| File | Title |
|------|-------|
| `src/app/(auth)/login/page.tsx` | Login — Supabase signInWithPassword |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard |
| `src/app/(dashboard)/clients/page.tsx` | Clients |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Client Profile |
| `src/app/(dashboard)/pipeline/page.tsx` | Pipeline (Kanban skeleton) |
| `src/app/(dashboard)/pipeline/[id]/page.tsx` | Lead Detail (doc gate zones visible) |
| `src/app/(dashboard)/targets/page.tsx` | Targets |
| `src/app/(dashboard)/analytics/page.tsx` | Analytics |
| `src/app/(dashboard)/settings/page.tsx` | Settings |
| `src/app/api/auth/[...supabase]/route.ts` | Supabase OAuth callback handler |

### shadcn/ui Components (auto-generated in src/components/ui/)
badge, breadcrumb, button, card, checkbox, calendar, command, dialog, alert-dialog, avatar,
dropdown-menu, input, label, pagination, popover, progress, scroll-area, select, separator,
sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip

---

## Key Architecture Decisions

### Tailwind v4 — CSS-first config
The scaffold created Next.js 16 + Tailwind v4. Tailwind v4 does NOT use `tailwind.config.ts`.
All theme tokens are defined in `globals.css` using `@theme {}` directive.
All design spec tokens (neutral scale, accent indigo, status colors, shadows, border-radius, keyframes) are implemented there.

### shadcn v4 + Tailwind v4
shadcn v4 is compatible with Tailwind v4. Components use CSS variables from globals.css.
`components.json` uses `"config": ""` (empty) because Tailwind v4 doesn't have a config file.
One fix applied: `calendar.tsx` line 87 — `table` classname had a type mismatch with react-day-picker types.

### Prisma 7 — adapter pattern
Prisma 7 is a major breaking change from prior versions:
1. `url` and `directUrl` no longer exist in `schema.prisma` datasource block
2. Connection URL must be defined in `prisma.config.ts` via `defineConfig({ datasource: { url: env("DATABASE_URL") } })`
3. PrismaClient requires an adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`
4. Installed: `@prisma/adapter-pg` + `pg` + `@types/pg`

### Sonner vs Toast
shadcn deprecated the `toast` component in v4. Using `sonner` instead (also shadcn-managed).
Toaster is mounted in root layout.

### LeadStageHistory model
Added `lead_stage_history` table (not in the task brief but present in directive Section 6 requirement for stage change audit trail). This is the cleanest approach — better than Supabase audit log for query flexibility.

### VP Commercial filter
`is_vp` field added to User model per directive. Middleware and layout read from `user.user_metadata.is_vp`. Full pipeline filter logic goes in the query layer (not scaffold scope — no data yet).

---

## What William Needs to Do

### 1. Fill .env.local
Open `/Users/williamsudhana/VF ERP System/execution/.env.local` and fill:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Project Settings > API
- `DATABASE_URL` — Transaction pooler URL (PgBouncer port 6543) from Supabase Project Settings > Database > Connection string
- `DIRECT_URL` — Session / direct URL (port 5432) — needed for Prisma Migrate

### 2. Run `npx prisma migrate dev`
After filling .env.local, run:
```bash
cd /Users/williamsudhana/VF\ ERP\ System/execution
npx prisma migrate dev --name init
```
This creates all tables in Supabase.

### 3. Run `npm run dev`
```bash
cd /Users/williamsudhana/VF\ ERP\ System/execution
npm run dev
```
App runs at http://localhost:3000 and redirects to /login.

---

---

## Phase 1B — Clients CRM
**Build Date:** 2026-05-18
**Status:** Complete. TypeScript: 0 errors (src files). Pre-existing prisma.config.ts error unchanged from Phase 1.

### File Map

#### API Routes
| File | Method | Purpose |
|------|--------|---------|
| `src/app/api/clients/route.ts` | GET, POST | List clients (search/health/industry filter), create client |
| `src/app/api/clients/[id]/route.ts` | GET, PATCH, DELETE | Client detail with full relations, update, hard delete |
| `src/app/api/clients/[id]/contacts/route.ts` | POST | Add contact to client |
| `src/app/api/clients/[id]/upsells/route.ts` | POST | Add upsell opportunity to client |
| `src/app/api/contacts/[contactId]/route.ts` | PATCH, DELETE | Update / delete a contact |
| `src/app/api/upsells/[upsellId]/route.ts` | PATCH | Update upsell status/fields |
| `src/app/api/users/route.ts` | GET | List active users — for AE dropdown selects |

#### Pages (fully implemented)
| File | Notes |
|------|-------|
| `src/app/(dashboard)/clients/page.tsx` | Server Component. Fetches clients + AE options directly via Prisma (no fetch). Passes to ClientsTable. URL search params drive filtering. Suspense with key for re-fetch on param change. |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Server Component. Full client detail. Passes serialized data to client components. 404 via notFound(). Dynamic metadata from DB. |

#### Client Components
| File | Justification for "use client" |
|------|-------------------------------|
| `src/components/clients/clients-table.tsx` | User interaction: search input, filter selects, row click, sheet/dialog open, delete |
| `src/components/clients/add-client-sheet.tsx` | Form state, submission, toast |
| `src/components/clients/edit-client-sheet.tsx` | Form state, pre-fill from prop, submission |
| `src/components/clients/contacts-card.tsx` | CRUD interactions: add/edit/delete contacts |
| `src/components/clients/upsells-card.tsx` | Add upsell, inline status update |
| `src/components/clients/notes-card.tsx` | Inline edit toggle + PATCH notes |
| `src/components/clients/ae-card.tsx` | Edit AE assignment inline |
| `src/components/clients/client-detail-actions.tsx` | Topbar Edit button opens EditClientSheet |

#### Pure (Server-compatible) Components
| File | Purpose |
|------|---------|
| `src/components/clients/health-badge.tsx` | HealthStatus badge with design token colors |
| `src/components/clients/upsell-status-badge.tsx` | UpsellStatus badge with design token colors |

### Architectural Decisions

**No Zod** — zod is not in package.json. Manual type-guard validation used throughout API routes. Pattern: `if (!isEngagementType(v)) return 400`. Keeps 0 extra dependencies.

**URL-param driven filtering on /clients** — search, health, industry filters stored as URL search params. Client component updates params via `router.replace()` with `useTransition`. Server Component re-renders on param change via Suspense boundary with `key={search-health-industry}`. No useEffect, no useState for data. Correct RSC pattern.

**Direct Prisma in page Server Components** — pages call `prisma.client.findMany()` directly, not via `/api/clients`. The API routes exist for client-side mutations (add, edit, delete from browser). This avoids an unnecessary internal HTTP round-trip during SSR.

**Date serialization boundary** — Prisma returns `Date` objects, client components expect `string`. All dates serialized to `.toISOString()` before passing as props or from API responses. The `ClientForEdit` interface in `edit-client-sheet.tsx` accepts `string | null` for dates.

**Decimal serialization** — Prisma `Decimal` fields (`monthlyValue`, `annualValue`, `estimatedValue`) cast via `Number()` before JSON serialization. Types reflect this: `number | null` not `Decimal | null`.

**Primary contact management** — when setting a contact as primary, a `updateMany` clears `isPrimary` on sibling contacts first, then creates/updates the target contact. Atomic enough for this use case; no transaction needed.

**`router.refresh()`** — all mutations call `router.refresh()` to re-run the server component data fetch without a full page navigation. This is the correct RSC mutation pattern.

### Known Pre-existing Issues (not introduced by Phase 1B)
- `prisma.config.ts` line 12: TS error on `directUrl` — Prisma 7 type definition gap. Runtime works. Not our code.

---

## Phase 1C — Clients UI Rework
**Build Date:** 2026-05-18
**Status:** Complete. TypeScript: 0 new errors (pre-existing prisma.config.ts error unchanged).

### Scope
Client Management Structure directive — 13-field schema surfaced across list page, detail page, add/edit forms, and API routes.

### New Fields Integrated
| Field | Prisma Column | Notes |
|-------|---------------|-------|
| `clientStatus` | `client_status` (ClientStatus enum) | active / inactive / lead |
| `orgSize` | `org_size` (String?) | Fixed dropdown values |
| `customerCode` | `customer_code` (String? unique) | Read-only in UI — auto-generated |

### Files Changed
| File | Change |
|------|--------|
| `src/types/index.ts` | Added `ClientStatus` type; updated `Client` interface with `customerCode`, `orgSize`, `clientStatus` |
| `src/components/clients/client-status-badge.tsx` | New — same pattern as `health-badge.tsx`. active=green, inactive=gray, lead=indigo |
| `src/components/clients/clients-table.tsx` | New columns: Code (monospace chip), Status (badge), Org Size. Replaced industry free-text filter with fixed values. Added Client Status filter. Removed Contract End column (replaced by Annual Value). |
| `src/components/clients/add-client-sheet.tsx` | Added clientStatus (default lead), orgSize. Industry converted from free text Input to fixed Select. |
| `src/components/clients/edit-client-sheet.tsx` | Same field additions as add-sheet. customerCode shown as read-only subtitle in sheet header. Industry/orgSize as fixed Select. |
| `src/components/clients/client-detail-actions.tsx` | `ClientForEdit` interface updated with new fields. |
| `src/app/(dashboard)/clients/page.tsx` | Added `status` URL param. fetchClients accepts status filter. Suspense key updated. ClientsContent passes statusFilter. |
| `src/app/(dashboard)/clients/[id]/page.tsx` | customerCode shown as monospace badge next to client name in header. ClientStatusBadge added alongside HealthBadge. Org Size added to Contract Details card. clientForEdit object carries all new fields. |
| `src/app/api/clients/route.ts` | `isClientStatus()` guard added. GET: status query param filter. POST: clientStatus + orgSize written. |
| `src/app/api/clients/[id]/route.ts` | `isClientStatus()` guard added. PATCH: clientStatus + orgSize update. GET: fields included via Prisma spread. |

### Architectural Decisions
**customerCode is read-only** — displayed as a monospace `<code>` chip in the table, detail header, and edit sheet header. No input field — auto-generated at record creation time (generation logic is DB-side or future seeding step).

**Industry filter** — changed from insensitive `contains` partial match to exact match (`SELECT` from fixed list), consistent with fixed enum semantics. API route still uses `contains` for backward compat with any existing free-text data in DB.

**`clientStatus` default is `lead`** — matches Prisma schema default. Add Client form also defaults to `lead`.

**Table column swap** — removed Contract End (lower immediate value for daily use) to fit 8 columns cleanly. Contract End remains visible on detail page.

---

## Phase 2A — BizDev Sales Pipeline (Kanban)
**Build Date:** 2026-05-18
**Status:** Complete. TypeScript: 0 errors.

### File Map

#### API Routes
| File | Methods | Purpose |
|------|---------|---------|
| `src/app/api/leads/route.ts` | GET, POST | List leads (stage/sales/client/search filters), create lead |
| `src/app/api/leads/[id]/route.ts` | GET, PATCH, DELETE | Lead detail with relations, partial update, delete |
| `src/app/api/leads/[id]/stage/route.ts` | POST | Advance/change stage with gate validation + LeadStageHistory |
| `src/app/api/leads/[id]/invoice/route.ts` | POST | Request invoice — sets invoiceRequestedAt + stage → invoiced |
| `src/app/api/leads/[id]/documents/route.ts` | POST | Upload PDF to Supabase Storage, create PipelineDocument record |

#### Pages
| File | Type | Purpose |
|------|------|---------|
| `src/app/(dashboard)/pipeline/page.tsx` | Server Component | Kanban board page — Suspense shell, wraps PipelineKanbanLoader |
| `src/app/(dashboard)/pipeline/new/page.tsx` | Client Component | Redirects to /pipeline?new=1 to auto-open Add Lead sheet |

#### Components (all in `src/components/pipeline/`)
| File | "use client"? | Purpose |
|------|---------------|---------|
| `pipeline-kanban-loader.tsx` | Yes — useSearchParams, useState for sheet | Data fetcher + Add Lead button + sheet orchestrator |
| `pipeline-kanban.tsx` | Yes — DnD state, drag handlers, optimistic updates | 7-column kanban with @dnd-kit DnD, gate enforcement, lost deal dialog |
| `pipeline-card.tsx` | Yes — useSortable from @dnd-kit | Individual lead card with gate warning indicator |
| `pipeline-stage-badge.tsx` | No — pure display | Stage badge with design token colors per stage |
| `lead-form-sheet.tsx` | Yes — form state, client search combobox | Create lead slide-over sheet with all 11 fields |
| `document-upload-zone.tsx` | Yes — useDropzone, upload state | PDF upload zone (react-dropzone), calls documents API |
| `stage-history-timeline.tsx` | No — pure display | Ordered timeline of stage changes |

### Architectural Decisions

**Client-side data loading in PipelineKanbanLoader** — The kanban loads leads via `fetch("/api/leads")` on mount rather than direct Prisma in a Server Component. Reason: the "Add Lead" button and sheet state must share the same component tree as the kanban board, and after sheet submission the board must refetch. RSC mutation pattern (`router.refresh()`) would work for stage changes but not for the sheet-controlled refetch. The loader is a client component; data fetching happens in useEffect (justified: browser-initiated fetch with dynamic refetch, not an anti-pattern when the component itself manages refetch lifecycle).

**Optimistic updates on drag** — On drop, the lead card moves immediately in local state before the API call completes. If the API fails (gate blocked), the card reverts and a toast shows the gate error message. This gives instant feedback without UI freezing.

**Gate enforcement is server-side only** — The client checks `closed_won → invoiced` and intercepts `lost_deal` for the reason dialog, but all actual gate checks (quotation doc required, signed quotation required) happen in `/api/leads/[id]/stage/route.ts`. The client shows a warning icon on cards missing required docs, but cannot bypass the server gate.

**Lost Deal dialog** — Inline dialog (not shadcn Dialog) to avoid nested DndContext portals causing React tree issues. Simple HTML with Tailwind styling, matches design tokens.

**?new=1 URL param** — `/pipeline/new` redirects to `/pipeline?new=1`. The `PipelineKanbanLoader` reads this param via `useSearchParams()` and auto-opens the sheet. This makes the create URL directly linkable / bookmarkable. After sheet closes, URL cleans back to `/pipeline`.

**Document upload — anon key** — No `SUPABASE_SERVICE_ROLE_KEY` found in `.env.local`. Falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The `pipeline-docs` Supabase Storage bucket must be set to public OR RLS policies must allow authenticated uploads. William must configure this in Supabase dashboard.

**billingPlan → quarter is server-side** — Both POST and PATCH on leads recalculate `quarter` from `billingPlan` on the server. The form shows a live client-side preview via `billingPlanToQuarter()` but the canonical value is always computed server-side. No client trust.

**LeadStageHistory atomic** — Stage changes via `/stage` and `/invoice` both use `prisma.$transaction()` to update the lead and create the history record atomically. If either fails, both roll back.

### Known Requirements (William to action)
1. Create `pipeline-docs` bucket in Supabase Storage dashboard
2. Set bucket to Public (or add RLS policy allowing authenticated uploads)
3. If adding `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — service role key bypasses RLS and bucket can remain private

---

## Phase 2B — Multi-Condition Filter Panel
**Build Date:** 2026-05-18
**Status:** Complete. TypeScript: 0 errors.

### File Map
| File | Action | Notes |
|------|--------|-------|
| `src/components/ui/filter-panel.tsx` | CREATE | Exports FilterPanel component, applyConditions helper, all types |
| `src/components/pipeline/pipeline-kanban-loader.tsx` | MODIFY | Replaced MultiSelectFilter x3 with FilterPanel |
| `src/components/clients/clients-table.tsx` | MODIFY | Replaced ColumnFilter + Health Select with FilterPanel |
| `src/app/(dashboard)/clients/page.tsx` | MODIFY | Simplified fetchClients — removed DB-level filter params |

### Key Decisions

**Cast path for SerializedLead:** `lead as unknown as Record<string, unknown>` — TypeScript strict mode does not allow direct cast from a typed interface without an index signature to `Record<string, unknown>`. Double-cast via `unknown` is the correct pattern; avoids disabling strict mode.

**applyConditions numeric `is`/`is_not`:** Checks `typeof fieldVal === "number"` before numeric comparison, falls back to string comparison. This prevents false matches on string fields that happen to parse as numbers.

**clients/page.tsx simplified to search-only:** `fetchClients` now filters only by `name` (search param). All health/status/industry/ae/orgSize filtering moved client-side via FilterPanel's `applyConditions`. This is correct for CRM data volumes — avoid premature server-round-trip complexity. `initialTotal` prop kept on `ClientsTable` for interface compatibility; display count now uses `filteredClients.length`.

**FilterPanel is stateless for conditions:** Parent (loader/table) owns `conditions[]` and `matchMode` state. FilterPanel is a controlled component that fires `onChange(conditions, matchMode)`. This lets the parent apply `applyConditions` in its own `useMemo`.

**Popover width 560px:** Fits [Field 160px] + [Operator 160px] + [Value flex-1] + [X 28px] + padding without horizontal overflow on standard laptop viewports.

**"Clear all" conditional visibility:** Only renders when `conditions.length > 0` — reduces visual noise.

---

## Phase 2C — Inline Field Editing + Change History
**Build Date:** 2026-05-18
**Status:** Complete. TypeScript: 0 errors.

### File Map
| File | Change Type | Description |
|------|-------------|-------------|
| `prisma/schema.prisma` | Modified | Added `LeadFieldHistory` model + reverse relations on `Lead` (fieldHistory) and `User` (fieldChangesActioned) |
| `src/types/index.ts` | Modified | Added `LeadFieldHistory` interface; added `fieldHistory?` to `Lead` interface |
| `src/app/api/leads/[id]/route.ts` | Modified | GET: include `fieldHistory` with changer. PATCH: atomic `$transaction` — detects changes for `projectedRevenue`/`projectType`/`billingPlan` vs `existing`, creates `LeadFieldHistory` rows only when value changed. `serializeLead`: serializes `fieldHistory.changedAt`. |
| `src/app/(dashboard)/pipeline/[id]/page.tsx` | Modified | `fetchLead`: include `fieldHistory`. `serializedLead`: map `fieldHistory` with `.toISOString()`. Pass `fieldHistory` to `LeadDetailClient`. |
| `src/components/pipeline/field-history-timeline.tsx` | New | Timeline mirroring `stage-history-timeline.tsx` dot+connector design. Formats IDR for `projectedRevenue`, human labels for `projectType`, as-is for `billingPlan`. Empty state. |
| `src/components/pipeline/lead-detail-client.tsx` | Modified | Added `SerializedFieldHistory` + `fieldHistory[]` to `SerializedLead`. Added reusable `InlineField` wrapper (pencil icon, save/cancel, label). Added `ProjectedRevenueInline`, `ProjectTypeInline`, `BillingPlanInline` components. Replaced 3 static Lead Detail rows with inline components. Added Change History card in right sidebar below Stage History. |

### Key Decisions

**Transaction shape:** `prisma.$transaction([leadUpdate, ...historyCreates])` returns an array. Destructure `const [lead] = await prisma.$transaction(...)`. History `create()` calls return scalars; only `lead` is used.

**Field change detection:** `toHistoryString(field, value)` normalizes Prisma Decimal and string values to `string | null` for comparison. Only writes history when `oldStr !== newStr` — prevents noise from no-op PATCHes (e.g. PATCH called with unchanged billingPlan).

**`InlineField` wrapper:** Extracted once for the pencil icon / save / cancel UI pattern shared across all 3 inline fields. Each field component (`ProjectedRevenueInline`, `ProjectTypeInline`, `BillingPlanInline`) owns its own state and fetch call — explicit, independently typed, no over-abstraction.

**billingPlan dual validation:** Client-side regex check before fetch call; server-side validation in PATCH handler already existed. Belt-and-suspenders.

**Prisma generate required after schema change:** `npx prisma db push` pushes schema to DB; `npx prisma generate` regenerates the client types. Both must run. TSC pass confirms types are correct.

**Dev server:** Already running on port 3000. Not restarted.

## Next Phase Tasks

- Dashboard live data components (KPI cards, revenue progress, contract alerts)
- Analytics charts with Recharts
- Settings user management CRUD

---

## Phase 0 Items #5, #7, #8 — Error Boundaries + Analytics Audit + Pagination
**Build Date:** 2026-07-02
**Status:** Complete. TypeScript: 0 errors. `npm run build`: clean (24/24 pages).

### Files Created
| File | Notes |
|------|-------|
| `src/app/(dashboard)/error.tsx` | Dashboard route-level error boundary. Client component. Card + Button from shadcn. "Coba lagi" calls `reset()`. "Ke Dashboard" hardlinks to `/dashboard`. Shows `error.digest` ID. |
| `src/app/global-error.tsx` | Root-level catastrophic error boundary. Must include `<html><body>` — cannot use shadcn providers. Styled with inline CSS matching design tokens (accent-500 = #6366f1, card shadow, neutral palette). |

### Analytics Audit (Tugas B) — No Changes Required
All analytics sections are already charted. Audit findings:
- Win Rate by AE/Industry: `BarChart` horizontal (tabbed) — done
- Revenue Trend: `LineChart` 3 series won/active/potential — done
- Product Line breakdown: `BarChart` vertical — done
- Pipeline Funnel: `BarChart` horizontal, click-to-drill modal — done
- Client Retention: stat list + progress bar — data is scalar counts not time-series; bar is correct, not "data without chart"

### Files Modified — Pagination (Tugas C)
| File | Change |
|------|--------|
| `src/components/clients/clients-table.tsx` | URL-driven `?page=` pagination at 25/page. `goToPage()` via `router.replace`. Resets on sort/search/filter change. Count shows "halaman X/Y". Pagination control from existing `pagination.tsx`. |
| `src/components/pipeline/pipeline-list-view.tsx` | `currentPage` + `onPageChange` props added. Internal `pagedLeads` slices `sortedLeads`. Footer calcs operate on current page only. Select-all targets current page only. `pagedEffectiveLeads` replaces `effectiveLeads`. |
| `src/components/pipeline/pipeline-kanban-loader.tsx` | Owns `?page=` URL param via `listPage` + `goToListPage()`. Resets page when filter conditions change. Passes page props to `PipelineListView`. |

### Architecture Notes — Pagination
- All data is fully client-loaded in both tables — client-side slice is the correct approach; no API route changes needed
- `?page=` is preserved in URL — shareable links, browser-back-safe
- `buildPageRange()` handles ≤7 pages (no ellipsis) and larger ranges with ellipsis — shared pattern in both tables
- Pipeline list pagination resets when kanban filter conditions change (via the same `useEffect` that syncs filter to URL)

---

## Sprint 1 Analytics — Date Range Filter + AE Filter + CSV Export
**Build Date:** 2026-05-19
**Status:** Complete. TypeScript: 0 new errors (2 pre-existing TS errors in targets/page.tsx unrelated to this build).

### Files Modified
| File | Change |
|------|--------|
| `src/app/(dashboard)/analytics/page.tsx` | Added searchParams param; date + AE filter Prisma where clauses; lostLeadsByAE groupBy; allAEUsers query; Export button removed from Topbar |
| `src/components/analytics/analytics-content.tsx` | FilterBar component (preset tabs + custom date inputs + AE multi-select popover); Export button with CSV generation; `lost` field added to AE performance table |

### Feature 1: Date Range Filter

Preset math is calculated **client-side** in `getPresetDates()` and stored as ISO date strings in URL params (`?from=YYYY-MM-DD&to=YYYY-MM-DD`). The server component reads these params, parses them in `resolveDateRange()`, and builds Prisma where clauses.

| Preset | from | to |
|--------|------|----|
| Minggu Lalu | Last Monday (dayOfWeek offset) | Last Sunday |
| Bulan Lalu | 1st of last month | Last day of last month (via `new Date(y, m, 0)`) |
| 3 Bulan | 1st of 3 months ago | Last day of last month |
| Custom | User input | User input, clamped to max 3 years span |
| Semua | `undefined` | `undefined` — no filter |

`detectPreset()` reverse-maps active URL params back to a preset label so the segmented button correctly highlights after a page load or back-navigation.

Date filter application in Prisma:
- **Closed-stage leads** (won, lost, revenue): `closedAt` filter with an `OR` branch for leads where `closedAt IS NULL` → falls back to `createdAt`
- **All leads / funnel / industry**: `createdAt` filter
- **Client retention denominator**: unfiltered (always total clients in system)

### Feature 2: AE / Busdev Filter

`?aeIds=id1,id2` comma-separated URL param. Applied as `salesId: { in: aeIds }` on all lead queries. AE dropdown fetches `isActive: true, role: { in: ["account", "admin"] }` users in the server component and passes as `allAEUsers` prop.

Popover is a shadcn `Popover` + `PopoverContent`. Selecting any AE immediately triggers `router.replace()` to update the URL — no intermediate apply step. "Hapus filter" clears `aeIds` from URL while preserving the active date range.

Both filters are ANDed: if both `from/to` and `aeIds` are set, leads must satisfy both conditions.

### Feature 3: CSV Export

Export button moved from Topbar (server component) into `AnalyticsContent` (client component) so it can access `aePerformance` data without a server round-trip.

`exportAEPerformanceCSV()`:
1. Builds CSV string with 7 columns: Busdev/AE, Total Leads, Won, Lost, Win Rate, Total Revenue, Avg Revenue Per Won
2. Revenue columns use `formatIDRPlain()` — `Rp 1.500.000` (Indonesian locale). Wrapped in CSV double-quotes to escape the locale's period/comma.
3. Creates `Blob` (`text/csv;charset=utf-8`), generates `ObjectURL`, clicks a temporary `<a>` element, then revokes the URL.
4. Filename: `vf-analytics-ae-{dateRangeLabel}-{YYYY-MM-DD}.csv`

`WinRateByAE` type gained a `lost` field — added to the server groupBy query and the type export.

### Architecture Note
Export button was previously a dead placeholder in Topbar (server component), which cannot have onClick handlers. Moving it to the client component (`AnalyticsContent`) is the correct pattern — no client-only API call, data already in component memory.

---

## Role System Refactor — Single Source of Truth
**Build Date:** 2026-05-19
**Status:** Complete. TypeScript: 0 errors.

### Problem Fixed
Layout fetched role from `user.user_metadata?.role` (Supabase). API routes checked Prisma DB. Two sources of truth → 403 errors when email was not in DB or role differed. Fix: Prisma DB is now the only source of truth for role everywhere.

### New Files
| File | Purpose |
|------|---------|
| `src/lib/require-role.ts` | Shared auth helper — requireRole(), requireAdmin(), requireAdminOrDirector(), requireCanEditClients(), requireCanCreateLeads(), requireAuthenticated() |
| `src/lib/supabase/admin-client.ts` | Service-role client for Supabase invite emails (requires SUPABASE_SERVICE_ROLE_KEY) |
| `scripts/fix-admin-user.mjs` | One-shot script to ensure william.sudhana@gmail.com is admin in DB |

### Schema Change
`prisma/schema.prisma` — added `commercial_director` to Role enum. Run: `npx prisma migrate dev --name add-commercial-director-role`

### Permission Matrix Applied
| Endpoint | Guard |
|----------|-------|
| All GET reads | requireAuthenticated |
| Targets POST/PATCH/DELETE | requireAdminOrDirector |
| Clients POST/PATCH/DELETE | requireAdminOrDirector |
| Contacts/Upsells write | requireAdminOrDirector |
| Leads POST (create) | requireCanCreateLeads |
| Leads PATCH/stage/invoice/docs | requireCanCreateLeads + ownership check for account role |
| Leads DELETE | requireAdmin |
| Bulk-reassign | requireAdmin |
| Users GET | requireAuthenticated |
| Users POST (create) | requireAdmin + Supabase invite |
| Users PATCH/DELETE | requireAdmin |

### UI Changes
- Sidebar: Targets hidden for operation role; Settings icon in footer admin-only; role display labels (e.g. "Commercial Director" not "commercial_director")
- Settings: ROLE_OPTIONS includes commercial_director; ROLE_LABEL map for display names; badge color added for commercial_director
- Analytics: account role forced to own AE ID; AE filter dropdown hidden for account role; commercial_director included in AE users queries

### William Action Required
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` AND Vercel — get from Supabase Dashboard → Project Settings → API → Service Role key
2. Run `npx prisma migrate dev --name add-commercial-director-role` to apply enum change to production DB
3. Run `node scripts/fix-admin-user.mjs` to ensure william.sudhana@gmail.com is admin in DB

---

## UX Patterns — General Reference

### Type-to-Confirm Delete Dialog
**When to use:** Any hard (permanent) delete action where accidental clicks are a real risk — client delete, user delete, bulk operations, anything irreversible.

**Pattern:** AlertDialog with an Input field. The destructive action button stays `disabled` until the user types the exact target name.

**Implementation in `client-detail-actions.tsx` (reference):**

```tsx
const [confirmInput, setConfirmInput] = useState("")

function openDeleteDialog() {
  setConfirmInput("")   // always reset on open
  setDeleteOpen(true)
}

// In AlertDialog — prevent close while deleting
<AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Hapus [Entity]?</AlertDialogTitle>
      <AlertDialogDescription asChild>
        <div className="space-y-3">
          <p>Tindakan ini tidak bisa dibatalkan. ...</p>
          <div className="space-y-1.5">
            <p className="text-xs text-neutral-500">
              Ketik{" "}
              <code className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-xs border border-neutral-200">
                {targetName}
              </code>{" "}
              untuk konfirmasi:
            </p>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={targetName}
              disabled={deleting}
              autoComplete="off"
            />
          </div>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDelete}
        disabled={deleting || confirmInput !== targetName}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
      >
        {deleting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Menghapus...</> : "Hapus"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Key rules:**
- `setConfirmInput("")` on every open — never carry over previous input
- `onOpenChange` guard: `if (!deleting) setDeleteOpen(open)` — prevents dismiss during API call
- Button: `disabled={deleting || confirmInput !== targetName}` + `disabled:opacity-40`
- Use `asChild` on `AlertDialogDescription` when wrapping non-`<p>` content (e.g. `<div>`) to avoid hydration warnings
- The `<code>` chip for the target name uses `bg-neutral-100 text-neutral-700 font-mono border border-neutral-200` — consistent with design tokens

### Block Delete with Dependency Check (API Pattern)
**When to use:** When a record has child/linked records that must be resolved first.

**Pattern:** Before `prisma.entity.delete()`, count blocking dependencies. If count > 0, return 409 with a descriptive Indonesian-language message.

```ts
const activeLeadCount = await prisma.lead.count({
  where: {
    clientId: id,
    stage: { notIn: ["lost_deal", "invoiced", "no_response"] },
  },
})
if (activeLeadCount > 0) {
  return NextResponse.json(
    { error: `Entity ini masih punya ${activeLeadCount} lead aktif di pipeline. Selesaikan lead tersebut terlebih dahulu.` },
    { status: 409 }
  )
}
```

The error message from 409 propagates naturally to `toast.error()` in the client — no special handling needed on the frontend.

---

## Phase 0 Item #3 — Storage Security Refactor (Private Bucket + Signed URLs)
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run build`: clean (24/24 pages).

### Problem
`pipeline-docs` bucket was PUBLIC. Upload route fell back to anon key when service role key was absent. DB stored full public URLs. Documents were accessible without authentication.

### Bucket Status
- **Before:** `public: true`
- **After:** Set to `public: false` via `PUT /storage/v1/bucket/pipeline-docs` with service role key during this session

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| `src/lib/supabase/admin-client.ts` | Modified | Added `import "server-only"` guard; changed from null-return to throw on missing key |
| `src/app/api/leads/[id]/documents/route.ts` | Modified | Replaced `getStorageClient()` fallback with `createAdminClient()`; stores storage path instead of public URL |
| `src/app/api/documents/[id]/url/route.ts` | Created | Returns 5-min signed URL for any PipelineDocument; handles legacy full-URL records via `extractStoragePath()` |
| `src/components/pipeline/document-upload-zone.tsx` | Modified | Replaced `<a href={fileUrl}>` with button that fetches signed URL on-demand via new endpoint |
| `src/app/api/users/route.ts` | Modified | Removed null check on adminClient (now throws on missing key) |
| `src/app/api/users/[id]/route.ts` | Modified | Removed null guards; wrapped DELETE Supabase auth cleanup in its own try-catch |
| `src/app/api/users/[id]/invite/route.ts` | Modified | Removed null check and 503 early return |

### Security Model (New)
```
Upload:
Client (FormData) → POST /api/leads/[id]/documents (auth-gated)
    → service role key → private bucket
    → DB stores path: "leads/{id}/{type}-{ts}.pdf"

View:
Client (button click) → GET /api/documents/[id]/url (requireAuthenticated)
    → createSignedUrl(path, 300s) → signed URL returned
    → window.open() in new tab (URL expires in 5 min)
```

### Backward Compatibility
`extractStoragePath()` in the signed URL route handles both:
- New format: `"leads/abc/quotation-123.pdf"` (path only)
- Legacy format: `"https://...supabase.co/storage/v1/object/public/pipeline-docs/leads/abc/..."` (full public URL)

No DB migration needed for existing records.

### Manual Test Steps
1. **Upload:** Go to Pipeline → Lead Detail → drop a PDF. Check DB — `fileUrl` should be a path string, not an https:// URL.
2. **View:** Click the ExternalLink icon next to a document. Should open PDF in new tab via signed URL (URL contains `?token=...`).
3. **Expired URL:** Copy a signed URL, wait 5+ minutes, paste in incognito → should return 400/403.
4. **Bucket private:** `curl -I "https://dgzwjsibrqgwqxjvzozz.supabase.co/storage/v1/object/public/pipeline-docs/leads/..."` → should return 400 or 403.

---

## Phase 1 Batch 2B — Weighted Forecast, Coverage Ratio, Lost Reason, Stage Config Editor
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run test`: 69/69 pass. `npm run build`: clean (24/24 pages).

### Files Changed

| File | Action | Notes |
|------|--------|-------|
| `src/lib/stage-config.ts` | Modified | Stripped Prisma import — now client-safe only. Exports: Zod schemas, `PipelineStageConfig` type, `DEFAULT_STAGE_CONFIG`, `stageProbability()`. |
| `src/lib/stage-config.server.ts` | Created | `import "server-only"` guard. Re-exports client-safe items. Adds `getStageConfig()` with Prisma. All server callers import from here. |
| `src/app/(dashboard)/dashboard/page.tsx` | Modified | Reads stageConfig, extracts forecastStages. 17th Promise.all query: weighted forecast leads. Computes `weightedForecast`. Passes `weightedForecast` + `weightedForecastDrillDown` to DashboardContent. |
| `src/components/dashboard/dashboard-content.tsx` | Modified | Added `WeightedForecastLead` type, `"weighted_forecast"` DrawerType, drawer meta, `WeightedForecastDrillTable`. KPI grid: 4-col to 5-col. Added 5th card "Weighted Forecast". |
| `src/app/(dashboard)/targets/page.tsx` | Modified | Reads stageConfig, extracts forecastStages. `weightedPipelineLeads` query. `bpWeightedMap` per billingPlan. `weightedPipeline: Math.round(...)` in each `QuarterData`. |
| `src/components/targets/targets-content.tsx` | Modified | Added `PipelineCoverageRow` sub-component. Renders after ForecastBar for non-closed quarters with `revenueTarget > 0`. |
| `src/app/(dashboard)/analytics/page.tsx` | Modified | `lostReasonGroups` groupBy query (lost_deal stage, date-filtered). `LOST_REASON_LABELS` Indonesian map. Null reason maps to "(belum dikategorikan)". Passes `lostReasonDist` to AnalyticsContent. |
| `src/components/analytics/analytics-content.tsx` | Modified | Added `LostReasonDist` import, `lostReasonDist` prop, `LostReasonTooltip`, "Alasan Deal Hilang" horizontal BarChart section (red fill). |
| `src/components/settings/settings-pipeline-tab.tsx` | Created | Client component. Admin + commercial_director only (read-only for others). Table: 8 stages x probability input x countsAsForecast Switch. Save: Zod-validates, PATCHes `/api/system-config/pipeline_stage_config`. Reset: restores DEFAULT_STAGE_CONFIG. Warning banner about manual probability. |
| `src/app/(dashboard)/settings/page.tsx` | Modified | Reads `getStageConfig()` in Promise.all. Passes `initialStageConfig` to SettingsContent. |
| `src/components/settings/settings-content.tsx` | Modified | Imports `SettingsPipelineTab` + `PipelineStageConfig`. Renders "Pipeline Configuration" card (4th card). |

### Key Decision: Server/Client Module Split

**Problem:** `stage-config.ts` had Zod schemas AND `getStageConfig()` (Prisma) in one file. When `settings-pipeline-tab.tsx` (client component) imported schemas, Next.js bundled Prisma for browser — Node.js `tls` module missing — build failure.

**Solution:** Split into two files.
- `stage-config.ts` — client-safe: Zod, types, defaults. No Prisma.
- `stage-config.server.ts` — `import "server-only"` guard + `getStageConfig()`.

**Rule:** Any server-only Prisma accessor must live in a `.server.ts` file with the `server-only` import guard. Client components import schemas/types from the base file only.

### Weighted Forecast Formula

```
weightedForecast = SUM(projectedRevenue x probability / 100)
                   for all leads where stage.countsAsForecast = true
                   AND projectedRevenue IS NOT NULL
                   AND probability IS NOT NULL
```

`countsAsForecast` is config-driven (stored in `SystemConfig.pipeline_stage_config`), not hardcoded. Default forecast stages: `pipeline`, `negotiation`, `contract_renewal`.

### Pipeline Coverage Ratio (Targets)

```
remaining = max(0, target - actual)    // clamp at 0 on over-achievement
ratio = weightedPipeline / remaining   // summed across all billingPlans in the quarter
```

Color thresholds: green >= 3x, amber 1.5-3x, red < 1.5x. `remaining = 0` shows "x" green. `revenueTarget = 0` (no target set): component returns null.

### Prisma Enum Cast Pattern

`getStageConfig()` keys are `string[]` after `Object.entries()`. Prisma requires `$Enums.PipelineStage[]`.

```ts
import { $Enums } from "@prisma/client"
forecastStages as $Enums.PipelineStage[]
```

Applied in: `dashboard/page.tsx`, `targets/page.tsx`.

### Stage Config API

Reuses existing `PATCH /api/system-config/[key]` (admin-gated). Body: full `PipelineStageConfig` object as `{ value: {...} }`. Client Zod-validates before send. Server validates on receipt.

---

## Phase 2 — Global Command Palette (Cmd+K)
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run build`: clean (25/25 pages).

### Files Created / Modified

| File | Action | Notes |
|------|--------|-------|
| `src/app/api/search/route.ts` | CREATED | GET /api/search?q= — parallel Prisma queries, requireAuthenticated |
| `src/components/shared/command-palette.tsx` | CREATED | Client component — hotkey, debounce, role-gated nav |
| `src/app/(dashboard)/layout.tsx` | MODIFIED | Added CommandPalette mount + import |
| `src/components/ui/command.tsx` | UNTOUCHED | Already existed via shadcn — no scaffold needed |

### Key Decisions

**command.tsx — no scaffold needed.**
`src/components/ui/command.tsx` already existed with full shadcn implementation including `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandSeparator`. No `npx shadcn add` call needed.

**Role-gating mirrors sidebar exactly.**
Sidebar uses `NON_COMMERCIAL_ROLES = ["operation", "hr", "finance"]` to hide Pipeline and Targets. Command palette uses identical logic — extracted into `getNavItems(role)`. Settings only shown to admin / commercial_director.

**"Client Baru" quick action links to /clients (not /clients?new=1).**
Verified: clients page has no `?new=1` handler. Only pipeline has this pattern. Brief says "kalau tidak ada, link ke /clients saja" — confirmed and applied.

**API search — no Zod on input.**
`q` is a plain string from URL search param. `src/lib/validations/` is off-limits per brief. A `q.length < 2` guard on the server is sufficient — no external payload.

**"use client" justification.**
Three requirements force client-side: (1) `keydown` event listener for Cmd+K, (2) controlled `open` state for CommandDialog, (3) debounced `fetch` to /api/search. Server Component cannot satisfy any of these.

**Mount point: dashboard layout (Server Component).**
`sessionUser` is already built in layout.tsx. Passed as prop to `<CommandPalette user={sessionUser} />` — clean boundary, no additional auth call.

**Exported extras.**
`CommandPaletteTrigger` button and `useCommandPaletteOpen` hook are exported from the component file for sidebar/topbar integration if needed.

### Search Behavior
- Debounce: 250ms
- Min query length: 2 chars (enforced client + server)
- Results limit: 5 per entity (Client, Lead, Contact)
- Mode: Prisma `mode: "insensitive"` (ILIKE)
- Navigate on select: clients → /clients/[id], leads → /pipeline/[id], contacts → /clients/[clientId]

### NOT touched (per brief)
- `prisma/schema.prisma`
- `src/lib/validations/**`
- Any existing `src/app/api/**` routes

---

## Phase 2 Batch 3A — Chatter Core (Comments + Followers)
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors from authored files. `npm run test`: 109/109 pass (89 pre-existing + 20 new). Build: pre-existing TS failures in other agents' uncommitted files (`activity-panel.tsx`, `pipeline/[id]/page.tsx`) block `npm run build` — not introduced by this batch.

### Migration Name
`20260702162058_add_comment_follower`

### Files Created
| File | Purpose |
|------|---------|
| `prisma/migrations/20260702162058_add_comment_follower/migration.sql` | Applied migration |
| `src/lib/mention-parser.ts` | Pure `extractMentionIds(body)` — no imports, testable without DB |
| `src/lib/mentions.ts` | `parseMentions(body)` (async, DB-validates active users); re-exports `extractMentionIds` |
| `src/lib/validations/comment.ts` | `CreateCommentSchema`, `UpdateCommentSchema` |
| `src/app/api/comments/route.ts` | GET + POST |
| `src/app/api/comments/[id]/route.ts` | PATCH + DELETE |
| `src/app/api/followers/route.ts` | GET + POST + DELETE |
| `src/lib/validations/__tests__/comment.test.ts` | 20 assertions (schema + pure mention extraction) |

### Files Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `Comment`, `Follower` models + back-relations on `User`, `Lead`, `Client` |
| `src/app/api/leads/route.ts` | POST wrapped in `$transaction`; auto-follow creator + salesId |

### API Contract

**GET /api/comments?leadId=uuid | ?clientId=uuid**
Response: `{ comments: Comment[] }`

**POST /api/comments**
Body: `{ body: string, leadId?: string, clientId?: string }`
Response: `{ comment: Comment }` 201
Side effects: author auto-followed; mentioned users auto-followed

**PATCH /api/comments/:id**
Body: `{ body: string }`
Response: `{ comment: Comment }` — author only; re-parses mentions; new mentioned users auto-followed

**DELETE /api/comments/:id**
Response: `{ success: true }` — author or admin; soft delete

**Comment shape:**
```ts
{
  id: string
  body: string             // may contain @[Name](uuid) tokens
  mentions: string[]       // validated active user IDs, server-parsed
  leadId: string | null
  clientId: string | null
  authorId: string
  createdAt: string        // ISO 8601
  editedAt: string | null
  deletedAt: string | null // null for non-deleted
  author: { id: string; name: string }
}
```

**GET /api/followers?leadId=uuid | ?clientId=uuid**
Response: `{ followers: Follower[] }`

**POST /api/followers**
Body: `{ leadId?: string, clientId?: string }` — user follows themselves (idempotent upsert)
Response: `{ follower: Follower }` 201

**DELETE /api/followers**
Body: `{ leadId?: string, clientId?: string }` — user unfollows themselves
Response: `{ success: true }`

**Follower shape:**
```ts
{
  id: string
  userId: string
  leadId: string | null
  clientId: string | null
  createdAt: string        // ISO 8601
  user: { id: string; name: string }
}
```

### Mention Format
`@[Display Name](userId)` — e.g. `@[Alice Tan](550e8400-e29b-41d4-a716-446655440000)`
Client sends raw body text. Server parses and validates. `mentions[]` in Comment = active user IDs only.

### Key Decisions

**Pure parser in separate file** — `mention-parser.ts` has zero imports. Vitest cannot initialize Prisma (DATABASE_URL absent in test env). Separating the regex extractor lets tests import it without triggering Prisma singleton.

**Follower unique constraint design** — Two separate `@@unique` blocks: `[userId, leadId]` and `[userId, clientId]`. A follower row for a lead is distinct from one for a client. Prisma upsert keys named `userId_leadId` and `userId_clientId` respectively.

**Auto-follow in leads POST** — Wrapped existing `prisma.lead.create` in `$transaction`. Auto-follow upserts are inside the same transaction — atomic with lead creation. Change is minimal: no logic moved, just wrapped.

**Soft delete** — `deletedAt` field only. GET filters `{ deletedAt: null }`. Hard deletes via cascade (when Lead/Client is deleted, comments/followers cascade). No hard delete API for comments.

---

## Phase 2 Batch 4A — Notification Core
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run test`: 122/122 pass (+13 new). `npm run build`: clean.

### Migration Name
`20260702163152_add_notification`

### Files Created
| File | Purpose |
|------|---------|
| `prisma/migrations/20260702163152_add_notification/migration.sql` | Applied migration |
| `src/lib/notifications.ts` | `createNotification` + `createNotifications` helpers with actor-skip guard |
| `src/lib/validations/notification.ts` | `NotificationTypeSchema`, `CreateNotificationInputSchema`, `MarkReadSchema` |
| `src/lib/validations/__tests__/notification.test.ts` | 13 assertions |
| `src/app/api/notifications/route.ts` | GET |
| `src/app/api/notifications/[id]/route.ts` | PATCH |
| `src/app/api/notifications/read-all/route.ts` | POST |

### Files Modified (trigger wiring)
| File | Change |
|------|--------|
| `src/app/api/comments/route.ts` | Mention trigger on POST — inside $transaction |
| `src/app/api/comments/[id]/route.ts` | Mention trigger on PATCH (newly-added mentions only) — refactored to single $transaction |
| `src/app/api/leads/route.ts` | lead_assigned trigger on POST |
| `src/app/api/leads/[id]/route.ts` | lead_assigned trigger on PATCH (salesId change only), outside sequential tx |
| `src/app/api/leads/bulk-reassign/route.ts` | lead_assigned trigger (single bulk notification), added name to user selects |

### Key Decisions

**PATCH comment trigger: newly-added mentions only.** On edit, diff `mentionedUserIds` against `existing.mentions`. Only users newly added get a notification. Prevents re-notifying people who were already mentioned.

**Bulk-reassign: single notification, not per-lead.** `updateMany` doesn't give per-lead client names. One notification with count is accurate and not fabricated.

**lead_assigned on PATCH: outside sequential transaction.** Existing `prisma.$transaction([...])` sequential array form. Notification runs after the array transaction resolves. Safe: if the transaction throws, notification never executes.

**`createNotifications` uses `createMany`.** Batch insert instead of N individual creates.

**`unreadCount` always in GET response.** Even when `unread=1` filter is active, the count reflects total unread. UI bell badge uses this field.

### API Contract for UI Agent (Bell + /notifications page)

**GET /api/notifications**
```
Query: unread=1 (optional), limit=N (1–100, default 20)
Response: { notifications: Notification[], unreadCount: number }
```

**PATCH /api/notifications/[id]**
```
Body: { action: "read" }
Auth: owner only. Idempotent.
Response: { notification: Notification }
Errors: 400 (bad body), 403 (not owner), 404
```

**POST /api/notifications/read-all**
```
Body: (none)
Response: { markedRead: number }
```

**Notification shape:**
```ts
{
  id: string
  userId: string
  type: "mention" | "lead_assigned" | "activity_due" | "activity_overdue" | "alert" | "stage_change"
  title: string
  body: string | null
  entityType: string | null   // "lead" | "client" | null
  entityId: string | null     // UUID, or null
  readAt: string | null       // null = unread
  createdAt: string           // ISO datetime
}
```

---

## Phase 2 Batch 2 — Activity UI
**Build Date:** 2026-07-02
**Status:** Complete. `npx tsc --noEmit`: 0 errors. `npm run test`: 109/109 pass. `npm run build`: clean (29/29 routes, /activities appears as dynamic route).

### Files Created
| File | Purpose |
|------|---------|
| `src/components/activities/activity-status.ts` | Pure helper: `getActivityStatus(dueDate)` returns upcoming/today/overdue. `ACTIVITY_STATUS_CLASSES` maps status to Tailwind token classes. `formatActivityDate()` for display. No JSX — server+client safe. |
| `src/components/activities/activity-dot.tsx` | `ActivityDot` — small colored dot with Tooltip. Three states: (1) activity exists — dot colored by status, tooltip shows subject + date. (2) no activity — grey dot, tooltip "Tidak ada activity terjadwal". (3) stale — grey dot + AlertTriangle icon, tooltip "Deal tanpa aktivitas lebih dari 7 hari". |
| `src/components/activities/activity-panel.tsx` | `ActivityPanel` — full "Planned Activities" card component. Fetches `GET /api/activities?leadId=X&status=open` on mount. Per-row: type icon, subject, colored due date, assignee name, Done/Reschedule/Cancel actions. "+ Activity" button opens Sheet with form. After Done: AlertDialog "Schedule next activity?" with same form (next-activity discipline). |
| `src/components/activities/activities-view.tsx` | `ActivitiesView` — /activities page client component. Groups activities: Overdue (red header) / Hari Ini (orange) / Mendatang (green). Per row: ActivityDot, type icon, subject, lead/client link, due date, inline Done + Reschedule. "Semua Tim" toggle for admin/commercial_director. Optimistic list update on Done. |
| `src/app/(dashboard)/activities/page.tsx` | Server Component. Direct Prisma fetch (no internal HTTP). Role-checks `canViewAllTeam`. `?team=1` URL param switches between `fetchMyActivities(userId)` and `fetchAllActivities()`. Passes serialized data + assigneeOptions to ActivitiesView. |

### Files Modified
| File | Change |
|------|--------|
| `src/components/pipeline/pipeline-card.tsx` | Added `nextActivityAt: string | null` to `SerializedLead` interface. Added `isStaleWithoutActivity()` (7-day threshold, open stages only). ActivityDot in card footer (always shown). Stale flag triggers ActivityDot warning icon. |
| `src/components/pipeline/lead-detail-client.tsx` | Added `currentUserId` + `assigneeOptions` props to `LeadDetailClientProps` / `LeadDetailClient`. ActivityPanel in right column inside `id="section-activities"`. "Activities" smart button (scroll type) added to SmartButtons row. Imported `ClipboardList` from lucide. |
| `src/app/(dashboard)/pipeline/[id]/page.tsx` | Fetch `currentDbUser.id` (changed select from `{ role }` to `{ id, role }`). Compute `currentUserId`. Pass `currentUserId` and `assigneeOptions={salesOptions}` to `LeadDetailClient`. |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Fetch `currentDbUser.id`. Compute `currentUserId`. Add ActivityPanel in right column (`id="section-client-activities"`). "Activities" smart button. Imported `ClipboardList` + `ActivityPanel`. |
| `src/components/layout/sidebar.tsx` | Added `/activities` nav item (ClipboardList icon) under COMMERCIAL group, positioned between Pipeline and Clients. Added `NON_COMMERCIAL_ROLES` filter rule for `/activities` (same restriction as `/pipeline`). |

### Key Decisions

**ActivityPanel uses client-side fetch, not RSC direct query** — The panel is embedded inside `LeadDetailClient` which is already "use client". It needs independent refresh after mutations (Done, Reschedule, Cancel) without re-rendering the entire lead detail. `useEffect` fetch is justified here: browser-initiated, mutation-driven refetch lifecycle.

**`initialFocus` removed from Calendar** — react-day-picker v9 (shadcn v4) dropped this prop. Removed from all three Calendar usages. TypeScript caught this cleanly.

**Stale flag logic** — `nextActivityAt === null AND updatedAt > 7 days AND stage in [leads, pipeline, negotiation, contract_renewal]`. Won/lost/invoiced/no_response excluded — stale flag is only meaningful for open pipeline.

**Color convention matches Odoo pattern** — success-500 (green) = upcoming, warning-500 (orange) = today, danger-500 (red) = overdue, neutral-300 (grey) = none. Uses existing `@theme` tokens from globals.css.

**`/activities` route** — Server Component with direct Prisma (consistent with other detail pages). Role check + dataset selection done server-side. Team toggle updates URL (`?team=1`), Next.js re-renders server component — no client state for data.

**`date-fns` `format` usage** — confirmed available via react-day-picker dependency. Used for `yyyy-MM-dd` serialization and display formatting in Calendar popover triggers.

**Empty state text** — No emoji per design system check (globals.css has no emoji in utility classes; existing codebase uses no emoji in UI text). Empty state: "Pipeline bersih / Tidak ada activity open."
