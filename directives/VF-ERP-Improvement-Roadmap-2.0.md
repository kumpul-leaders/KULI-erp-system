# VF ERP — Improvement Roadmap 2.0
**Created:** 2026-05-20
**Status:** Planning — Sprint 5 ready to execute, Sprint 6 scoped
**Live URL:** https://vf-erp.vercel.app

---

## Overview

Roadmap 2.0 melanjutkan dari Roadmap 1.0 (Sprint 1–4 selesai). Fokus utama:

1. **Sprint 5 — Analytics Completeness:** Item yang tertinggal dari Roadmap 1.0
2. **Sprint 6 — Client-Pipeline Deep Linking:** Menghubungkan data Pipeline ke Client secara bidireksional — Client jadi "living document" yang mencerminkan status nyata dari Pipeline, bukan data yang diisi manual.

Visi Sprint 6: Client detail page jadi satu-satunya sumber kebenaran tentang klien — riwayat project, nilai kumulatif, peluang aktif, semua terhitung otomatis dari Pipeline.

---

## Sprint Progress

| Sprint | Items | Done | Status |
|--------|-------|------|--------|
| Sprint 5 — Analytics Completeness | 2 | 1 | 🔄 In Progress |
| Sprint 6 — Client-Pipeline Deep Linking | 6 | 6 | ✅ Complete |

---

## Sprint 5 — Analytics Completeness

> Dipindah dari Roadmap 1.0. Item yang belum diimplementasi.

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 5.1 | Overall Win Rate metric — lost deals / total pitched | Analytics | ✅ | Formula: `lost_deal / (lost_deal + pipeline + negotiation + closed_won + invoiced + contract_renewal)`. Exclude `leads` dan `no_response`. Tampil sebagai metric card ke-4 di Row 2 Analytics. Displays loss rate (lost/pitched). |
| 5.2 | Stage gate & product lines configurable dari Settings | Settings | 🔲 | Deferred dari Sprint 4. Admin bisa edit gate requirements tanpa code change. Butuh `SystemConfig` model (JSON field) + Settings UI + runtime read di gate logic. Significant scope — estimate 1 sprint sendiri. |

---

## Sprint 6 — Client-Pipeline Deep Linking

> Goal: Client data reflects live Pipeline activity. Goodbye manual fields.

### Design Decisions (Confirmed)

**Annual Value → Cumulative Value:**
- `Client.annualValue` field di DB **tetap ada** (backward compat, 291 clients imported data).
- Di UI: **tidak ditampilkan lagi**. Diganti dengan `Cumulative Value` yang dihitung otomatis.
- **Cumulative Value** = `SUM(actualRevenue)` dari semua leads milik client ini dengan stage `closed_won`, `invoiced`, atau `contract_renewal`.
- `annualValue` masih bisa diedit via Edit Client sheet jika diperlukan, tapi tidak menjadi primary display metric.

**Opportunity Value:**
- Computed field (tidak disimpan di DB).
- = `SUM(projectedRevenue)` dari leads milik client dengan stage `leads`, `pipeline`, atau `negotiation`.
- Mewakili total potensi revenue dari deals yang sedang berjalan.

**Linked Projects (Wikilinks):**
- Bidirectional: Client detail → semua Pipeline leads. Pipeline list → client name → client detail.
- Client detail page jadi hub: Won Projects + Open Opportunities + Lost Deals.

---

### Sprint 6 Items

| # | Item | Area | Status | Notes |
|---|------|------|--------|-------|
| 6.1 | Clients: Default sort Name A-Z | Clients | ✅ | Default di `buildOrderBy` + searchParams fallback: `name / asc`. |
| 6.2 | Replace Annual Value → Cumulative Value di Clients table | Clients | ✅ | Kolom "Annual Value" dihapus. "Cumulative Value" computed via `groupBy` won stages. Sortable (in-JS). Contract urgency badge preserved. |
| 6.3 | Clients table: tambah kolom "Opportunity Value" | Clients | ✅ | Kolom baru `SUM(projectedRevenue)` open stages. Second `groupBy`. Sortable. |
| 6.4 | Client detail: "Linked Projects" section (wikilinks) | Clients | ✅ | 3 buckets explicit: Active/In Progress/Closed. Each row: stage badge + product line + quarter + revenue. Link ke `/pipeline/[id]`. |
| 6.5 | Pipeline list view: Company name → link ke Client detail | Pipeline | ✅ | `<Link>` + `stopPropagation`. `lead.client.id` sudah ada di SerializedLead. |
| 6.6 | Client detail: Cumulative Value + Opportunity Value sebagai KPI cards | Clients | ✅ | KPI row di header: Cumulative (won sum) + Opportunity (open sum). Dihitung dari same leads query yang dipakai 6.4. |

---

## Implementation Notes — Sprint 6

### Query Pattern untuk Computed Values

Karena 291 clients + potentially banyak leads, gunakan `groupBy` bukan `include leads`:

```ts
// Cumulative Value per client
const cumulativeByClient = await prisma.lead.groupBy({
  by: ["clientId"],
  where: { stage: { in: ["closed_won", "invoiced", "contract_renewal"] }, actualRevenue: { not: null } },
  _sum: { actualRevenue: true },
})
// → Map<clientId, cumulativeValue>

// Opportunity Value per client
const opportunityByClient = await prisma.lead.groupBy({
  by: ["clientId"],
  where: { stage: { in: ["leads", "pipeline", "negotiation"] }, projectedRevenue: { not: null } },
  _sum: { projectedRevenue: true },
})
// → Map<clientId, opportunityValue>
```

Merge ke clients array setelah fetch. Tidak ada schema change.

### Linked Projects di Client Detail

Query leads dengan semua relasi yang dibutuhkan:

```ts
const leads = await prisma.lead.findMany({
  where: { clientId: id },
  include: { sales: { select: { name: true } } },
  orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
})
```

Serialize Decimal → Number, Date → ISO string. Group client-side by status bucket.

### Pipeline → Client link

```tsx
// Di pipeline-list-view.tsx, Company cell:
<Link
  href={`/clients/${lead.client.id}`}
  onClick={(e) => e.stopPropagation()}
  className="font-medium text-neutral-800 hover:text-blue-600 hover:underline transition-colors"
>
  {lead.client.name}
</Link>
```

Membutuhkan `lead.client.id` di `SerializedLead` — cek apakah sudah ada. Jika tidak, tambah ke include di `api/leads` GET.

### clientStatus Auto-sync

Sudah diimplementasikan di Phase 3 (`syncClientStatus`). Saat Sprint 6, verify bahwa:
- `active` = ada lead dengan stage `closed_won`, `invoiced`, atau `contract_renewal`
- `inactive` = pernah ada won lead tapi tidak active sekarang
- `lead` = belum pernah ada won lead

Tidak perlu perubahan — hanya audit untuk memastikan sync berjalan.

---

## Backlog (belum di-sprint)

| Item | Notes |
|------|-------|
| Auth/Invite: Resend Invite + Send Password Reset | Tambah ke Settings DropdownMenu. `adminClient.auth.admin.inviteUserByEmail()` (resend) + `generateLink({ type: 'recovery' })` (reset password). |
| Sprint 4.4 carry-over: Stage gate configurable | Masuk Sprint 5.2 |
| YoY filter scope untuk Analytics (done) | Fixed di Sprint 4 post-Veri |

---

## Changelog

| Date | Sprint | Change |
|------|--------|--------|
| 2026-05-20 | Roadmap 2.0 | Created. Sprint 5 moved from 1.0. Sprint 6 scoped: 6 items Client-Pipeline deep linking. |
| 2026-05-20 | Sprint 5.1 | Overall Win/Loss Rate metric card implemented. Loss rate = lost_deal / (lost_deal + pipeline + negotiation + closed_won + invoiced + contract_renewal). 4th card in Analytics Row 2. |
| 2026-05-20 | Sprint 6 | All 6 items complete. Default sort A-Z. Cumulative + Opportunity Value in Clients table. Linked Projects + KPI cards in client detail. Pipeline company name → client link. |
