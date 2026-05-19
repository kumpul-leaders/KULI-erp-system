# VF ERP — Improvement Roadmap
**Last Updated:** 2026-05-19
**Status:** Sprint 1 Complete
**Live URL:** https://execution-phi.vercel.app

---

## Overview

Post Phase 1–3 improvement plan. 4 sprints, 33 total items. Scope: CRM + BizDev Pipeline — HRM/Finance tetap out of scope. Sprint 1 adalah critical blocker; Sprint 2–3 UX dan data accuracy; Sprint 4 nice-to-have backlog.

## Sprint Progress

| Sprint | Items | Done | Status |
|--------|-------|------|--------|
| Sprint 1 — Critical | 7 | 7 | ✅ Complete |
| Sprint 2 — UX/Flow | 11 | 0 | 🔲 Not Started |
| Sprint 3 — Data Accuracy | 8 | 0 | 🔲 Not Started |
| Sprint 4 — Nice-to-Have | 6 | 0 | 🔲 Not Started |

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
| 2.1 | C1: Health status null default untuk new client | Clients | 🔲 | Ubah default dari "healthy" ke null di Add Client form. Files: `add-client-sheet.tsx`, `api/clients/route.ts` |
| 2.2 | C2: Primary AE dropdown restricted ke role Busdev/AE (active only) | Clients | 🔲 | Files: `add-client-sheet.tsx`, `edit-client-sheet.tsx`, `api/clients/route.ts` |
| 2.3 | P2: Billing Plan di Kanban Card Fields | Pipeline | 🔲 | Tambah billing_plan ke opsi Card Fields popover. File: `pipeline-card.tsx` |
| 2.4 | Dashboard: Expiring contracts tampilkan nilai kontrak | Dashboard | 🔲 | Tambah monthlyValue/annualValue di expiry list. Files: `dashboard/page.tsx`, `dashboard-content.tsx` |
| 2.5 | Dashboard: Drill-down sort + filter | Dashboard | 🔲 | Add sort header + search di Sheet drill-down. File: `dashboard-content.tsx` |
| 2.6 | Dashboard: KPI trend indicator — ↑↓ % vs last month per KPI card | Dashboard | 🔲 | Files: `dashboard/page.tsx` (tambah query prev month), `dashboard-content.tsx` |
| 2.7 | Pipeline: Visual cue closed_won → invoiced blocked | Pipeline | 🔲 | Subtle badge/tooltip di closed_won column: "Gunakan 'Request Invoice'". File: `pipeline-kanban.tsx` |
| 2.8 | Pipeline: Filter persist di URL params | Pipeline | 🔲 | Encode active conditions ke URL params. Files: `pipeline/page.tsx`, `pipeline-kanban-loader.tsx` |
| 2.9 | Settings: Loading state + toast untuk activate/deactivate | Settings | 🔲 | Button loading state + sonner toast sukses/gagal. File: `settings-content.tsx` |
| 2.10 | Targets: Confirmation dialog sebelum delete | Targets | 🔲 | AlertDialog sebelum DELETE. File: `targets-content.tsx` |
| 2.11 | clientStatus: Manual override admin — Edit Status button di client detail | Clients | 🔲 | Admin only. Files: `clients/[id]/page.tsx`, `api/clients/[id]/route.ts` |

---

## Sprint 3 — Data Accuracy & Enrichment

> Goal: Pastikan angka-angka yang ditampilkan akurat dan data model lengkap.

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 3.1 | Analytics: Funnel conversion rates — % drop-off per stage transition | Analytics | 🔲 | Files: `analytics/page.tsx`, `analytics-content.tsx` |
| 3.2 | Analytics: Client Retention fix — 2 metric terpisah | Analytics | 🔲 | Metric 1: contract_renewal count; Metric 2: upsell won count. Files: `analytics/page.tsx`, `analytics-content.tsx` |
| 3.3 | Analytics: Win Rate = won/(won+lost) only | Analytics | 🔲 | Update query filter dari all leads ke won+lost_deal only. File: `analytics/page.tsx` |
| 3.4 | Analytics: Revenue Trend include contract_renewal | Analytics | 🔲 | Remove stage filter exclusion di revenue query. File: `analytics/page.tsx` |
| 3.5 | Clients: Multi-field search — name + industry + AE + customer code | Clients | 🔲 | File: `clients/page.tsx` |
| 3.6 | Clients: Contract urgency badge di table — merah/kuning kalau expiry < 30/60 hari | Clients | 🔲 | File: `clients-table.tsx` |
| 3.7 | Clients: Notes field di Add Client form | Clients | 🔲 | Tambah textarea Notes di AddClientSheet. File: `add-client-sheet.tsx` |
| 3.8 | Pipeline: Actual Revenue editable dari list view — inline edit di list view cell | Pipeline | 🔲 | File: `pipeline-list-view.tsx` |

---

## Sprint 4 — Nice-to-Have

| # | Item | Notes |
|---|------|-------|
| 4.1 | Drill-down dari chart ke underlying leads | Link dari Analytics chart ke filtered Pipeline view |
| 4.2 | Audit trail perubahan data client | Log setiap perubahan field penting di Client |
| 4.3 | YoY comparison Analytics | Tambah toggle Year-over-Year di Revenue Trend |
| 4.4 | Stage gate & product lines configurable dari Settings | Admin bisa edit tanpa code change |
| 4.5 | Recurring lead: preview detail sebelum bulk create | Konfirmasi daftar leads yang akan dibuat |
| 4.6 | Bulk reassign AE di Pipeline list view | Select multiple leads → reassign ke AE lain |

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

## Changelog

| Date | Sprint | Change |
|------|--------|--------|
| 2026-05-19 | — | Roadmap created from approved plan |
