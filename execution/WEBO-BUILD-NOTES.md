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
