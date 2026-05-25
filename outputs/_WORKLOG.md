# Master Work Log — VF ERP System

| Project | Last Session | Status | Notes |
|---------|-------------|--------|-------|
| VF ERP System | 2026-05-25 | Auth/Invite + Sprint 5.2 complete | Live: https://vf-erp.vercel.app. Deploy ke Vercel prod masih outstanding. |

---

## LAST SESSION: 2026-05-25

**Checkpoint:** Auth/Invite + Sprint 5.2 done. 4 commits hari ini: hotfix commit (backlog), auth actions, roadmap docs, SystemConfig.
**Status:** In Progress
**Outstanding:**
- [ ] Deploy ke Vercel prod (`npx vercel --prod` dari `execution/`) — seed-system-config.mjs perlu dijalankan di prod DB setelah deploy
- [ ] Sprint 5.3 (optional): Propagasi product line labels dari SystemConfig ke pipeline/kanban components
**Output:**
- `src/app/api/users/[id]/invite/route.ts` — POST resend invite + send password reset
- `src/components/settings/settings-content.tsx` — Resend Invite + Send Password Reset di dropdown; stage gates + product line labels inline-editable
- `prisma/schema.prisma` — SystemConfig model
- `scripts/seed-system-config.mjs` — seed stage_gates + product_line_labels
- `src/app/api/system-config/route.ts` — GET all config (auth required)
- `src/app/api/system-config/[key]/route.ts` — PATCH upsert (admin/director only)

---

## LAST SESSION: 2026-05-20

**Checkpoint:** Sprint 5.1 + Sprint 6 (6 items) complete. Analytics Overall Win/Loss Rate card. Clients: default sort A-Z, Cumulative Value + Opportunity Value columns. Client detail: KPI cards + Linked Projects section. Pipeline: company name → client link.
**Status:** In Progress
**Outstanding:**
- [ ] Auth/Invite: Resend Invite + Send Password Reset di Settings
- [ ] Sprint 5.2: Stage gate & product lines configurable dari Settings (significant scope — SystemConfig model)
- [ ] Deploy ke Vercel prod (`npx vercel --prod` dari `execution/`)
**Output:**
- `src/app/(dashboard)/analytics/page.tsx` — Sprint 5.1 Overall Win/Loss Rate
- `src/components/analytics/analytics-content.tsx` — Sprint 5.1 metric card
- `src/app/(dashboard)/clients/page.tsx` — Sprint 6.1/6.2/6.3
- `src/components/clients/clients-table.tsx` — Sprint 6.2/6.3
- `src/app/(dashboard)/clients/[id]/page.tsx` — Sprint 6.4/6.6
- `src/components/pipeline/pipeline-list-view.tsx` — Sprint 6.5

---

## Outstanding

Auth/Invite outstanding:
- Edit email di Settings hanya update Prisma DB — tidak create Supabase Auth record
- Team members yang belum diinvite tidak bisa login sama sekali
- Tidak ada fitur reset password / resend invite di app (harus manual via Supabase dashboard)
- Rencana: tambah "Resend Invite" + "Send Password Reset" di DropdownMenu Settings table

---

## Session Log

### 2026-05-19 — Account Manager Role + Settings UI + Auth Clarification
3 hal selesai hari ini. Commits: 9e55e14 (role + UI), 37380b7 (VALID_ROLES fix). Deployed ke https://vf-erp.vercel.app.
- `prisma/schema.prisma` — tambah `account_manager` ke Role enum (antara commercial_director dan account). `prisma db push` + generate.
- `src/types/index.ts` — Role type union diupdate (7 roles)
- `src/lib/require-role.ts` — account_manager masuk ke requireAuthenticated, requireCanEditClients, requireCanCreateLeads
- `src/app/(dashboard)/analytics/page.tsx` + `targets/page.tsx` + `clients/page.tsx` + `clients/[id]/page.tsx` — account_manager ditambah ke AE role filters
- `src/components/settings/settings-content.tsx` — container max-w-4xl, badge ungu Account Manager, actions column diganti DropdownMenu (ikon ⋯ → Edit / Deactivate / Activate)
- `src/app/api/users/route.ts` + `api/users/[id]/route.ts` — VALID_ROLES array diupdate, fix bug "role must be one of..." saat save Account Manager
- Sidebar + Settings page — commercial_director sudah punya akses Settings (manage team members)
- Bug fix `proxy.ts` (sesi sebelumnya) — stale middleware `/settings` gate dihapus, tidak ada lagi 307 redirect

Auth flow explanation (belum diimplementasi):
- Edit email di Settings = hanya Prisma DB, bukan Supabase Auth
- Login hanya bisa lewat invite link (user set password sendiri)
- Belum ada Resend Invite / Reset Password di app → next session

### 2026-05-19 — Role System Redesign (unplanned, post Sprint 2)
4 roles live: Super Admin, Commercial Director, Busdev/AE, Operations. Permission matrix enforced DB-side. Supabase invite flow. Schema enum migration. Commit 51c3333, deployed via `npx vercel --prod` → https://vf-erp.vercel.app.
- `prisma/schema.prisma` — User.role String → enum `Role { admin, commercial_director, account, operation, hr, finance }`. `prisma db push` via DIRECT_URL.
- `src/types/index.ts` — `Role` type updated: 6-value union
- `src/app/(dashboard)/layout.tsx` — **Critical fix**: role sekarang fetch dari Prisma DB (bukan `user_metadata`). Single source of truth. SessionUser memakai `dbUser.role`.
- `src/lib/require-role.ts` — **baru**: shared auth helper. `requireRole(...roles)` + named shortcuts: `requireAdmin`, `requireAdminOrDirector`, `requireCanEditClients`, `requireCanCreateLeads`, `requireAuthenticated`
- `src/lib/supabase/admin-client.ts` — **baru**: service role client `createAdminClient()` untuk Supabase invite. Graceful null jika `SUPABASE_SERVICE_ROLE_KEY` missing.
- 17 API routes — lokal `requireAdmin`/`requireAuth` di-replace dengan import dari `@/lib/require-role`. Account role: ownership check di lead PATCH/stage/invoice (salesId === user.id)
- `src/app/api/users/route.ts` — POST: setelah DB create, kirim Supabase invite email via `adminClient.auth.admin.inviteUserByEmail()`
- `src/components/layout/sidebar.tsx` — Targets hidden untuk operation role; Settings link di footer hidden untuk non-admin
- `src/components/analytics/analytics-content.tsx` — AE filter dropdown hidden untuk account role (hanya melihat data sendiri)
- `src/components/settings/settings-content.tsx` — `commercial_director` added to ROLE_OPTIONS + ROLE_LABEL map
- `scripts/fix-admin-user.mjs` — **baru**: one-shot script seed `william.sudhana@gmail.com` sebagai admin. Hasil: `✓ Created admin user (id: ac24fbb8-704d-4e1a-ae7d-17aed05f5c22)`. Pattern: Prisma 7 wajib pakai `PrismaPg` adapter.
- `SUPABASE_SERVICE_ROLE_KEY` — ditambah William ke `.env.local` + Vercel environment variables

### 2026-05-19 — Targets Bug Fixes (post Sprint 2)
Dua bug Targets page fixed. Commit 013edd1.
- **Bug 1 — Forbidden saat Set Target:** Root cause: `layout.tsx` baca role dari `user.user_metadata?.role` (Supabase), API routes cek Prisma DB — dua sumber kebenaran, misalign. Fix: layout baca dari Prisma DB. Fix kedua: seed William's gmail sebagai admin via `fix-admin-user.mjs`.
- **Bug 2 — Setahun Penuh revenue per bulan salah:** Input annual total tapi setiap bulan disimpan full amount. Fix di `targets-content.tsx` `handleSave`: `revenuePerMonth = Math.round(revenueTarget / 12)`, `ncPerMonth = Math.round(nc / 12)`. Label: `"— total setahun (÷12 per bulan)"`.

### 2026-05-19 — Sprint 2 (11 UX/flow items)
Sprint 2 selesai. 12 files changed (1 baru: `edit-status-button.tsx`), commit e63c934, deployed ke vf-erp.vercel.app.
- C1: `add-client-sheet.tsx` — healthStatus default null, "Not set" option
- C2: `clients/page.tsx` + `clients/[id]/page.tsx` — aeOptions filter: role account/admin + isActive
- P2: `pipeline-card.tsx` + `pipeline-kanban-loader.tsx` — billingPlan KanbanField option
- Dashboard: `dashboard/page.tsx` — monthlyValue/annualValue di serialization; prev month revenue query
- Dashboard: `dashboard-content.tsx` — expiry shows contract value; drill-down search+sort; TrendBadge ↑↓ % MTD
- Pipeline: `pipeline-kanban.tsx` — info note di closed_won column
- Pipeline: `pipeline/page.tsx` + `pipeline-kanban-loader.tsx` — filter persist via ?filter= base64 JSON
- Settings: `settings-content.tsx` — loadingUserId state + Loader2 spinner + sonner toast
- Targets: `targets-content.tsx` — AlertDialog delete confirmation
- Clients: `clients/[id]/page.tsx` + `edit-status-button.tsx` (baru) — admin-only Edit Status Sheet

### 2026-05-19 — Sprint 1 (7 critical items) + Analytics fix
Sprint 1 selesai. 23 files changed, commit 5c38078, pushed ke GitHub → Vercel auto-deploy.
- G1: Rename "Account Executive" → "Busdev/AE" — 8 komponen (`pipeline-kanban-loader.tsx`, `clients-table.tsx`, `dashboard-content.tsx`, `ae-card.tsx`, `lead-detail-client.tsx`, `pipeline-list-view.tsx`, `add-client-sheet.tsx`, `edit-client-sheet.tsx`)
- G2: Reassign resigned AE — `api/leads/bulk-reassign/route.ts` (baru), Smart Deactivate Dialog + Bulk Reassign section di `settings-content.tsx`, lead/client count queries di `settings/page.tsx`
- P1: Delete lead — hard delete admin-only di `api/leads/[id]/route.ts`, `DeleteLeadButton` di `lead-detail-client.tsx`
- P1: Filter operators extended — `filter-panel.tsx`: contains, not_contains, is_empty, is_not_empty, in, not_in (multi-select Popover)
- A1+A2: Analytics date range + AE filter — preset bar + URL-driven di `analytics-content.tsx`, Prisma queries di `analytics/page.tsx`
- A-Export: CSV export client-side Blob di `analytics-content.tsx`
- T1: Target per AE — schema `salesId` nullable (prisma db push), 3 tabs di `targets-content.tsx`, AE selector di `targets/page.tsx`
- Fix: `analytics/page.tsx` aeUsers query role: "account" → role: { in: ["account","admin"] }
- Fix: `settings-content.tsx` AlertDialog footer → AlertDialogAction/AlertDialogCancel semantics
- `directives/VF-ERP-Improvement-Roadmap.md` — dibuat + dipindah dari outputs; Sprint 1 semua ✅

### 2026-05-19 — Phase 3 clientStatus + Veri QC + GitHub push
Phase 3 selesai (clientStatus derive dari Lead data). Veri QC CONDITIONAL PASS → CRITICAL fix: targets API missing admin gate (PATCH/DELETE/POST). Phase 3 fixes: comment + backfill script. GitHub push: 136 files, commit 12f32d9.
- `src/lib/client-status.ts` — baru: `computeClientStatus` + `syncClientStatus`
- `src/app/api/clients/sync-status/route.ts` — baru: admin-only backfill endpoint
- `scripts/backfill-client-status.mjs` — baru: one-shot backfill script (26 active, 265 lead)
- `src/app/api/leads/[id]/stage/route.ts` — +syncClientStatus after transaction
- `src/app/api/leads/[id]/invoice/route.ts` — +syncClientStatus after transaction
- `src/app/api/leads/[id]/route.ts` — +syncClientStatus when stage in body
- `src/app/api/targets/route.ts` — POST upgraded requireAuth → requireAdmin (CRITICAL fix)
- `src/app/api/targets/[id]/route.ts` — PATCH + DELETE upgraded to requireAdmin (CRITICAL fix)

---

### 2026-05-19 — Pipeline UX: Billing Plan column + Lead Detail fixes
Tambah kolom Billing Plan di List View + Kanban, fix Prisma client out-of-sync, restore Description inline edit, pencil button jadi always-visible.
- `src/components/pipeline/pipeline-list-view.tsx` — +kolom "Billing Plan" sortable sebelum Quarter; footer +1 empty cell (column balance)
- `src/components/pipeline/pipeline-card.tsx` — billing plan tampil sebelum quarter di revenue row
- `prisma generate` dijalankan — Prisma client lama tidak kenal `fieldHistory` → PrismaClientValidationError di `/pipeline/[id]` resolved
- `src/components/pipeline/lead-detail-client.tsx` — +`DescriptionInline` component (col-span-2, click-to-edit, pencil di header); semua `InlineField` pencil button dari `opacity-0 group-hover` → always visible

### 2026-05-19 — Settings Page (Phase 2E)
User management CRUD (admin only) + Pipeline Reference card. 4 files. Veri: CONDITIONAL PASS → 3 issues fixed.
- `src/app/api/users/route.ts` — added POST: email validation, 409 duplicate, requireAdmin
- `src/app/api/users/[id]/route.ts` — PATCH partial + DELETE soft-deactivate (isActive=false)
- `src/app/(dashboard)/settings/page.tsx` — server component: fetch all users + current user role
- `src/components/settings/settings-content.tsx` — Add/Edit User Sheets, role badges, deactivate/activate with error feedback, Pipeline Reference (stage gates + product lines)

### 2026-05-19 — Targets Page (Phase 2D)
Monthly/quarterly target setting + actual vs target progress bars. 4 files: 2 API routes (upsert, PATCH/DELETE) + server page + client component. Veri: CONDITIONAL PASS, Issue 1 fixed.
- `src/app/api/targets/route.ts` — GET all + POST upsert (validation by type: monthly 1-12, quarterly 1-4)
- `src/app/api/targets/[id]/route.ts` — PATCH partial + DELETE 204
- `src/app/(dashboard)/targets/page.tsx` — 7 parallel Prisma queries: targets, actual revenue + new clients (monthly + quarterly)
- `src/components/targets/targets-content.tsx` — viewMode toggle, Set Target form, history table, progress bars (color-coded), optimistic state update

### 2026-05-19 — Analytics Page (Phase 2C)
5 charts live: Win Rate (By AE / By Industry tab), Revenue Trend 12M, Pipeline Funnel, Client Retention, AE Performance table. Server component + Recharts. Veri: PASS.
- `src/app/(dashboard)/analytics/page.tsx` — 9 parallel Prisma queries, Decimal/Date serialized
- `src/components/analytics/analytics-content.tsx` — Recharts BarChart/LineChart, tab toggle, typed tooltips, empty states

### 2026-05-19 — Recurring Lead Creation (Phase 2A UX)
Add Lead form untuk Retainer kini support bulk creation per range bulan — pilih "Mulai Bulan" + "Sampai Bulan", sistem create semua leads sekaligus via atomic DB transaction. One-time flow tidak berubah.
- `src/lib/utils.ts` — +`generateBillingPlanRange()` (ordinal arithmetic, no timezone drift) + `billingPlanToLabel()` (Indonesian month names)
- `src/app/api/leads/bulk/route.ts` — **baru**: POST `/api/leads/bulk`, validasi array YY-MM (max 36), `prisma.$transaction([...])` array form
- `src/types/index.ts` — +`BulkLeadCreatePayload` interface
- `src/components/pipeline/lead-form-sheet.tsx` — conditional billing range UI (retainer: 2 inputs + live preview "Akan membuat N leads · Jan – Des 2026"), split submit logic (single vs bulk)

### 2026-05-18 — Dashboard drill-down (Phase 2B+)
KPI cards + Client Health tiles jadi clickable. Klik buka Sheet dari kanan, list data di balik angka.
- `src/app/(dashboard)/dashboard/page.tsx` — refactor ke pure data fetching; +6 drill-down queries (parallel); serialize Decimal/Date
- `src/components/dashboard/dashboard-content.tsx` — baru: "use client", KPI cards + Health tiles sebagai `<button>`, Sheet drill-down (LeadDrillTable + ClientDrillTable), Expiring Contracts rows sebagai `<Link>`

### 2026-05-18 — Dashboard KPIs (Phase 2B)
4 KPI cards, Revenue vs Target progress bar, Expiring Contracts alert, Client Health summary, Recent Pipeline Activity. 9 Prisma queries parallel, semua server-rendered.
- `src/app/(dashboard)/dashboard/page.tsx` — dari skeleton → live data

### 2026-05-18 — Pipeline detail + Filter panel (Phase 2A UX)
Pipeline `[id]` detail page live. Generic FilterPanel multi-condition diimplementasi di Pipeline + Clients.
- `src/app/(dashboard)/pipeline/[id]/page.tsx` — fetch lead, generateMetadata, notFound()
- `src/components/pipeline/lead-detail-client.tsx` — Lead Details, Documents, Notes inline edit, Stage History, AE card, Advance Stage popover, Request Invoice, Lost Deal AlertDialog
- `src/components/ui/filter-panel.tsx` — [Field|Operator|Value|×] rows, AND/OR toggle, applyConditions() helper
- `src/components/pipeline/pipeline-kanban-loader.tsx` — FilterPanel replace MultiSelectFilter (8 fields); default → List view; kolom order: Invoiced → Contract Renewal → Lost Deal → No Response
- `src/components/clients/clients-table.tsx` — FilterPanel replace column filters (9 fields); client-side filter via useMemo

### 2026-05-18 — Pipeline UX improvements (Phase 2A UX)
Filter+sort per kolom, List View Pipeline dengan footer calculator, Kanban card click → detail, Card Fields popover, Kanban sort.
- `src/components/pipeline/pipeline-list-view.tsx` — spreadsheet view: 12 kolom, sortable headers, footer calculator (Count/Sum/Avg/Median)
- `src/components/pipeline/pipeline-kanban.tsx` — KanbanSortKey enum, sortLeadsForKanban()
- `src/components/pipeline/pipeline-card.tsx` — KanbanField type exported, visibleFields, click → /pipeline/[id]
- `src/app/(dashboard)/clients/page.tsx` — URL params sort/dir/ae/orgSize, server-side orderBy

### 2026-05-18 — BizDev Pipeline (Phase 2A)
Schema dirombak untuk Pipeline, 500 leads diimport dari Lark CSV. Kanban 8 kolom dengan DnD + gate logic.
- `prisma/schema.prisma` — PipelineStage (8 nilai), ProductLine enum, Lead model dirombak, Pitch dihapus
- `scripts/import-pipeline.mjs` — 500 baris CSV → Supabase, stage + product line mapping
- `src/app/(dashboard)/pipeline/page.tsx`, `src/app/api/leads/` (5 routes)
- `src/components/pipeline/` — 7 komponen (kanban loader, board DnD, card, badge, form sheet, upload zone, timeline)
- `directives/Product Line Mapping` — mapping CSV → DB enum (approved)

### 2026-05-18 — Client CRM (Phase 1) + Design System
Login page, /clients list + detail, 291 records dari Lark, schema 11 models. Design system spec + SOP onboarding.
- `src/app/(dashboard)/clients/`, `src/components/clients/` (11 components), `src/app/api/clients/` (4 routes)
- `scripts/import-clients.mjs` — Lark CSV → Supabase (idempotent)
- `prisma/schema.prisma` — +3 field di Client: clientStatus, orgSize, customerCode
- `outputs/design-system-spec.md` — full spec Tailwind/shadcn handoff (Wiux)
- `outputs/SOP-ERP-Onboarding-vosFoyer.md` — SOP onboarding tim vosFoyer

---

## Technical Notes

- `prisma db push` harus pakai DIRECT_URL (port 5432), bukan pooler (port 6543)
- Schema change: `npx prisma generate` → restart dev server (wajib) — kalau skip, Prisma client tidak kenal field baru → PrismaClientValidationError runtime
- Turbopack cache stale = silent error. Fix: `kill <pid>` + `rm -rf .next` + restart
- `.env` untuk Prisma CLI, `.env.local` untuk Next.js runtime
- Next.js 16: `params` di dynamic routes = `Promise<{id: string}>` — harus di-`await`
- Tailwind v4: CSS-first config di `globals.css`, tidak ada `tailwind.config.ts`
- Gate logic: leads→pipeline butuh quotation doc; negotiation→closed_won butuh signed quotation
- `clientStatus` nullable by design — di-derive dari Lead data saat Phase 3

---

## Phase 3 Note: clientStatus

Dibiarkan null sampai Phase 3. Definisi: `active` = ada Lead won berjalan; `inactive` = ada historical won tapi tidak active; `lead` = belum pernah won. Filter di `/clients` sudah ada di kode, tinggal uncommit. Implementasi: computed query atau DB trigger saat Lead stage berubah.
