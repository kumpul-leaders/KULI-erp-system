# Master Work Log — VF ERP System

| Project | Last Session | Status | Notes |
|---------|-------------|--------|-------|
| VF ERP System | 2026-05-19 | Completed (Phase 1–3) | Live: https://execution-phi.vercel.app. Roadmap tracker: `directives/VF-ERP-Improvement-Roadmap.md` |

---

## Outstanding

_Tidak ada. Phase 1–3 selesai dan live di Vercel._

---

## Session Log

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
