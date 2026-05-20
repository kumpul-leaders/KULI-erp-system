# VF ERP — Improvement Roadmap
**Last Updated:** 2026-05-19
**Status:** Role System Complete — Sprint 3 Next
**Live URL:** https://vf-erp.vercel.app

---

## Overview

Post Phase 1–3 improvement plan. 4 sprints, 33 total items + Role System milestone (unplanned). Scope: CRM + BizDev Pipeline — HRM/Finance tetap out of scope. Sprint 1 adalah critical blocker; Sprint 2–3 UX dan data accuracy; Sprint 4 nice-to-have backlog.

## Sprint Progress

| Sprint | Items | Done | Status |
|--------|-------|------|--------|
| Sprint 1 — Critical | 7 | 7 | ✅ Complete |
| Sprint 2 — UX/Flow | 11 | 11 | ✅ Complete |
| Role System — Unplanned | 1 | 1 | ✅ Complete |
| Sprint 3 — Data Accuracy | 8 | 8 | ✅ Complete |
| Sprint 4 — Nice-to-Have | 6 | 5 | ✅ Complete (4.4 deferred) |

---

## Sprint 1 — Critical Missing Functionality

> Goal: Tambahkan fitur-fitur yang saat ini completely missing dan blocking daily use.

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 1.1 | G1: Rename "Account Executive" → "Busdev/AE" (global) | General | ✅ | Semua komponen: `pipeline-kanban-loader.tsx`, `clients-table.tsx`, `analytics-content.tsx`, `settings-content.tsx`, `dashboard-content.tsx`, `lead-form-sheet.tsx`, `ae-card.tsx` |
| 1.2 | G2: Reassign Resigned AE — Smart Deactivate Dialog + Bulk Reassign di Settings | Settings | ✅ | Smart Deactivate Dialog + `/api/leads/bulk-reassign` endpoint + Bulk Reassign section di Settings |
| 1.3 | P1: Delete lead — confirm dialog + tombstone atau hard delete | Pipeline | ✅ | Hard delete, admin-only. `DELETE /api/leads/[id]` + `DeleteLeadButton` di `lead-detail-client.tsx` |
| 1.4 | P1: Filter operators tambah — contains, does not contain, is empty, is not empty + multi-select stage | Pipeline | ✅ | Tambah: contains, not_contains, is_empty, is_not_empty, in, not_in. Multi-select via Popover checkboxes |
| 1.5 | A1+A2: Analytics date range + AE filter | Analytics | ✅ | Preset bar: Semua/Minggu Lalu/Bulan Lalu/3 Bulan/Custom. AE multi-select Popover. URL-driven |
| 1.6 | A-Export: Export Analytics (functional) — Download CSV | Analytics | ✅ | Client-side CSV Blob, 7 kolom AE Performance, filename timestamped |
| 1.7 | T1: Full Year target + per Quarter one-row + AE breakdown | Targets | ✅ | Schema: `salesId` nullable di Target. 3 tabs: Per Bulan/Per Kuartal/Setahun Penuh. AE selector URL-driven |

**Schema Change (Sprint 1 — DONE):**
- [x] Tambah `salesId String? @map("sales_id")` ke Target model
- [x] Tambah relasi `sales User? @relation(fields: [salesId], references: [id])`
- [x] Update unique constraint: `@@unique([periodMonth, periodYear, type, salesId])`
- [x] `prisma db push` via DIRECT_URL (port 5432)
- [x] `npx prisma generate` + restart dev server

---

## Sprint 2 — UX, Flow & Data Visibility

> Goal: Perbaiki flow, visibility, dan UX yang sudah ada tapi kurang polished atau missing small pieces.

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 2.1 | C1: Health status null default untuk new client | Clients | ✅ | `initialForm.healthStatus = ""`, kirim null ke API, "Not set" option di Select |
| 2.2 | C2: Primary AE dropdown restricted ke role Busdev/AE (active only) | Clients | ✅ | `clients/page.tsx` + `clients/[id]/page.tsx` query filter: `role: { in: ["account","admin"] }, isActive: true` |
| 2.3 | P2: Billing Plan di Kanban Card Fields | Pipeline | ✅ | `billingPlan` added to KanbanField type + KANBAN_FIELD_OPTIONS + render block di card |
| 2.4 | Dashboard: Expiring contracts tampilkan nilai kontrak | Dashboard | ✅ | monthlyValue/annualValue included in serialization + rendered di expiry list |
| 2.5 | Dashboard: Drill-down sort + filter | Dashboard | ✅ | LeadDrillTable + ClientDrillTable: search input + clickable sort headers |
| 2.6 | Dashboard: KPI trend indicator — ↑↓ % vs last month per KPI card | Dashboard | ✅ | Prev month revenue query + TrendBadge helper + display di Revenue Won MTD card |
| 2.7 | Pipeline: Visual cue closed_won → invoiced blocked | Pipeline | ✅ | Info note di closed_won column: "Gunakan Request Invoice untuk advance" |
| 2.8 | Pipeline: Filter persist di URL params | Pipeline | ✅ | base64 JSON encode/decode via ?filter= param, synced via useEffect |
| 2.9 | Settings: Loading state + toast activate/deactivate | Settings | ✅ | loadingUserId state + Loader2 spinner + sonner toast sukses/gagal |
| 2.10 | Targets: Confirmation dialog sebelum delete | Targets | ✅ | AlertDialog dengan AlertDialogAction/Cancel |
| 2.11 | clientStatus: Manual override admin | Clients | ✅ | EditStatusButton component baru (Sheet: healthStatus + clientStatus), admin-only di client detail |

---

## Role System — Unplanned Milestone (Post Sprint 2)

> Goal: Implementasi 4-role permission system dengan single source of truth dari Prisma DB.

| # | Item | Status | Notes |
|---|------|--------|-------|
| R.1 | 4 roles: Super Admin, Commercial Director, Busdev/AE, Operations | ✅ | Enum `Role` di schema. `prisma db push` via DIRECT_URL. |
| R.2 | Single source of truth: Prisma DB (bukan Supabase user_metadata) | ✅ | `layout.tsx` fetch dari DB. 17 API routes pakai `require-role.ts`. |
| R.3 | Permission matrix enforcement | ✅ | Matrix A: Admin full; ComDir full kecuali Settings/user mgmt; Account: edit own leads only + analytics forced ke self; Ops: read-only, no Targets. |
| R.4 | Supabase invite flow (Settings → Add User) | ✅ | `createAdminClient()` + `inviteUserByEmail()`. Requires `SUPABASE_SERVICE_ROLE_KEY`. |
| R.5 | Targets Forbidden fix + Setahun Penuh ÷12 fix | ✅ | Root cause: role mismatch layout vs API. Fix: DB as single source. Setahun penuh: input annual total, simpan per-bulan = annual÷12. |
| R.6 | William admin seeded via `fix-admin-user.mjs` | ✅ | `william.sudhana@gmail.com` → id `ac24fbb8-704d-4e1a-ae7d-17aed05f5c22`, role: admin. |

**Key files:**
- `src/lib/require-role.ts` — `requireRole()` + named shortcuts (`requireAdmin`, `requireAdminOrDirector`, etc.)
- `src/lib/supabase/admin-client.ts` — `createAdminClient()` service role
- `src/app/(dashboard)/layout.tsx` — role dari Prisma DB
- `scripts/fix-admin-user.mjs` — seed admin pattern (Prisma 7: wajib PrismaPg adapter)

---

## Sprint 3 — Data Accuracy & Enrichment

> Goal: Pastikan angka-angka yang ditampilkan akurat dan data model lengkap.

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 3.1 | Analytics: Funnel conversion rates — % drop-off per stage transition | Analytics | ✅ | `FunnelStage.conversionRate: number|null`. Second-pass loop. Tooltip shows rate. |
| 3.2 | Analytics: Client Retention fix — 2 metric terpisah | Analytics | ✅ | Metric 1: contract_renewal distinct clients. Metric 2: closed_won+invoiced distinct clients. UI redesigned 3 rows. |
| 3.3 | Analytics: Win Rate = won/(won+lost) only | Analytics | ✅ | Denominator = `closed = won + lost`. Zero-division guard. |
| 3.4 | Analytics: Revenue Trend include contract_renewal | Analytics | ✅ | Stage filter: `["closed_won", "invoiced", "contract_renewal"]` |
| 3.5 | Clients: Multi-field search — name + industry + AE + customer code | Clients | ✅ | OR clause di `fetchClients` + GET /api/clients. Placeholder updated. |
| 3.6 | Clients: Contract urgency badge di table — merah/kuning kalau expiry < 30/60 hari | Clients | ✅ | `getContractUrgency()` helper. Badge di annual value cell. |
| 3.7 | Clients: Notes field di Add Client form | Clients | ✅ | `FormState.notes`, Textarea, POST body, API mapped. |
| 3.8 | Pipeline: Actual Revenue editable dari list view — inline edit di list view cell | Pipeline | ✅ | `ActualRevenueCell` component. cancelledRef fix (Escape). Optimistic overrides. Footer calc uses effective values. |

---

## Sprint 4 — Nice-to-Have

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Drill-down dari chart ke underlying leads | ✅ | AE bar → Pipeline filter salesId. Funnel bar → Pipeline filter stage. |
| 4.2 | Audit trail perubahan data client | ✅ | `ClientFieldHistory` model. PATCH diffs 12 fields, `createMany` audit. Change History card di client detail. |
| 4.3 | YoY comparison Analytics | ✅ | `revenuePY` field. PY query dengan date-shifted filter. Toggle "vs Prior Year". Dashed grey Line. |
| 4.4 | Stage gate & product lines configurable dari Settings | ⏸️ DEFERRED | Already view-only di Settings (Pipeline Reference card). Full editable config = Sprint 5 scope. |
| 4.5 | Recurring lead: preview detail sebelum bulk create | ✅ | Preview Dialog: numbered table billing plan + quarter. `confirmBulkCreate` gates the actual API call. |
| 4.6 | Bulk reassign AE di Pipeline list view | ✅ | Checkbox column + bulk action bar. `POST /api/leads/bulk-update`. onRefresh after reassign. |

---

## Sprint 5 — Analytics Backlog

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 5.1 | Analytics: Overall Win Rate — loss deal / total pitched | Analytics | 🔲 | Formula: `lost_deal / (lost_deal + pipeline + negotiation + closed_won + invoiced + contract_renewal)`. Tampil sebagai metric card terpisah di Analytics page. Exclude `leads` (pre-pitch) dan `no_response` dari denominator. Confirm denominator scope dengan William sebelum implement. |

---

## Context & Design Decisions

Developer reference untuk keputusan desain yang sudah dikonfirmasi William.

- **Health status new client:** Null (bukan "healthy") — health status hanya assign setelah ada historical data
- **Client Retention:** Dua metric terpisah — (1) contract_renewal count, (2) upsell won count — ditampilkan keduanya, bukan digabung
- **Target per AE:** Breakdown dari company yearly target — setiap AE punya porsi dari total company target
- **Reassign flow:** Dua mekanisme — (1) Smart Deactivate Dialog muncul otomatis saat admin deactivate user yang masih punya active leads/clients; (2) Bulk Reassign section di Settings untuk 7 resigned AE yang sudah ada di DB
- **Win Rate formula:** won / (won + lost_deal) — exclude leads yang masih in-progress dari denominator
- **prisma db push:** Selalu via DIRECT_URL (port 5432), bukan pooler (port 6543)
- **Schema change flow:** `prisma db push` → `npx prisma generate` → restart dev server — ketiga step wajib, jangan skip

---

## Context & Design Decisions (Tambahan)

- **Role system single source of truth:** Prisma DB — bukan Supabase `user_metadata`. Semua role check harus via email lookup ke DB.
- **Prisma 7 script pattern:** Script Node.js harus pakai `PrismaPg` adapter — `new PrismaClient({ adapter })`. Tidak bisa pakai `datasources` constructor (dihapus di Prisma 7).
- **Supabase service role:** `SUPABASE_SERVICE_ROLE_KEY` wajib ada di env untuk invite flow. Kalau tidak ada, `createAdminClient()` return null (graceful degradation, tidak crash).
- **Live URL:** https://vf-erp.vercel.app — GitHub auto-deploy kadang tidak trigger. Deploy manual via `npx vercel --prod` dari `execution/` directory.

---

## Changelog

| Date | Sprint | Change |
|------|--------|--------|
| 2026-05-19 | Role System | 4-role permission system: enum schema, require-role.ts, layout DB fetch, 17 API routes, invite flow, admin seed |
| 2026-05-19 | Targets Fixes | Forbidden fix (root cause: role mismatch); Setahun Penuh ÷12 fix |
| 2026-05-19 | Sprint 2 | 11 UX/flow items complete |
| 2026-05-19 | Sprint 1 | 7 critical items complete |
| 2026-05-19 | — | Roadmap created from approved plan |
