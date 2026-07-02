# PRD / Improvement Plan — VF ERP System Upgrade (Odoo + Lark Adaptation)

## Context

William ingin meng-upgrade VF ERP System (custom ERP vosFoyer, Phase 1 CRM + BizDev Pipeline, ~85-90% complete) dengan mengadaptasi pattern terbaik dari Odoo ERP dan Lark Suite — baik dari sisi functionality, interface, maupun user journey. Deep research (Riise) + codebase audit (Explore) + design synthesis (Plan agent) sudah dilakukan. Dokumen ini adalah hasil sintesisnya: gap analysis, phased roadmap, schema evolution, UI/UX direction, dan user journey redesign. **Belum ada perubahan kode apapun** — sesuai permintaan.

Insight kunci research:
1. **Weighted pipeline forecast** (Expected Revenue × Stage Probability) mengubah pipeline dari "daftar deals" jadi forecasting tool — fitur paling critical yang belum ada.
2. **Next-activity discipline** (Odoo): setiap deal wajib punya scheduled next action, dengan colored dot di kanban (green/orange/red) — pipeline hygiene feature paling underrated.
3. **Chatter per record** (Odoo): unified timeline notes + @mention + audit trail per lead/client.
4. **Lark patterns**: notification inbox, automation trigger-action, form-first entry, unified search.
5. Journey target: lead → qualification → proposal → won → delivery (health tracking) → T-60/T-30 renewal alerts → renewal deal linked ke deal asal.

## Koreksi Audit (verified langsung ke codebase)

- `forgot-password` / `set-password` pages **sudah ada** (`src/app/(auth)/`) — butuh QA end-to-end, bukan rebuild.
- Charts analytics **sebagian sudah render** (BarChart win rate by AE/industry di `analytics-content.tsx`) — sisanya (funnel, retention) perlu diverifikasi/wire.
- URL view state **baru di page layer**: `pipeline/page.tsx` menerima `?view=&filter=` tapi hanya `filter` yang di-pass ke loader — switch logic `view` belum berfungsi penuh (verifikasi awal Phase 2 sebelum extend).
- **Tidak ada `prisma/migrations` folder** — schema dideploy via `db push`. Harus di-baseline ke `prisma migrate` SEBELUM schema change apapun (risiko destruktif di production).
- `cmdk`, `next-themes`, `pagination.tsx` sudah terinstall tapi belum dipakai. `zod` belum ada.

## Gap Analysis (Pattern Odoo/Lark vs Existing)

| # | Pattern | Existing | Impact | Effort |
|---|---------|----------|--------|--------|
| 1 | Weighted pipeline forecast | Tidak ada (hanya raw projectedRevenue) | Critical | S |
| 2 | Stage probability auto-update | Tidak ada | High | S |
| 3 | Next-activity discipline | Tidak ada | High | M |
| 4 | Chatter per record | Partial 30% (field/stage history pasif, tanpa notes/@mention) | High | M |
| 5 | Multi-view switching | Partial 50% (kanban/list ada; calendar & per-user default belum) | High | M |
| 6 | Smart buttons di detail | Tidak ada | Med | S |
| 7 | Client health score 4-signal | Partial 20% (healthStatus manual) | High | M–L |
| 8 | Renewal alert + escalation | Partial 40% (visual 90 hari, tanpa tasking/T-30 escalation) | High | S–M |
| 9 | Kanban column count + value | Perlu cek/tambah | High | S |
| 10 | Inline editing list view | Tidak ada | Med | M |
| 11 | Structured lost reason | Partial (free text saja) | Med | S |
| 12 | Target + pipeline coverage ratio | Partial 60% (coverage 3–5x belum) | High | S |
| 13 | Notification inbox | Tidak ada | Med | M |
| 14 | Command palette / global search | Bahan ada (cmdk), belum dipakai | Med | S |
| 15 | Calendar view | Tidak ada | Med | M |

## Phased Roadmap (~10–13 minggu total, tiap phase shippable independen)

### Phase 0 — Hardening & Foundation (1–2 minggu) — PRASYARAT
1. **Baseline `prisma migrate`** (item pertama, wajib): `prisma migrate diff --from-empty --to-schema-datamodel` → `migrate resolve --applied`. Semua schema change setelahnya via `migrate dev/deploy`.
2. QA auth flow end-to-end (forgot-password → email → set-password → login) + Supabase email template/redirect.
3. Storage bucket `pipeline-docs`: buat bucket + RLS; pindah upload/download ke server-side route dgn service-role key + signed URLs (hapus anon key untuk storage).
4. Validation layer: `zod` + `src/lib/validations/` per entity, dipakai di API routes + forms.
5. Error boundaries (`error.tsx` per route group + global).
6. Hapus `isVp` dead code (via migration).
7. Verifikasi & lengkapi charts analytics (funnel/retention).
8. Wire pagination ke clients table + pipeline list view (server-side skip/take).
9. Test harness minimal: Vitest (validations) + Playwright smoke (login, create lead, drag stage).

### Phase 1 — Forecast & Pipeline Intelligence (2–3 minggu)
| Fitur | Schema | Catatan |
|-------|--------|---------|
| Stage probability config | **Tanpa migration** — `SystemConfig` key `pipeline_stage_config` (JSON: probability/order/color/countsAsForecast per stage) + typed accessor `src/lib/stage-config.ts` (Zod + fallback default) | Settings editor admin/commercial_director |
| Per-lead probability | `Lead.probability Decimal(5,2)`, `Lead.probabilityIsManual Boolean` | Stage change → auto-set dari config kecuali manual; backfill script on deploy |
| Weighted forecast | — | Dashboard KPI "Weighted Forecast"; Targets: kolom weighted + **coverage ratio** (weighted pipeline / sisa target, warning <3x) |
| Kanban column header stats | — | `count · Rp total · Rp weighted` per kolom |
| Structured lost reason | `enum LostReason {budget, competitor, timing, no_decision, requirements_mismatch, other}` + `Lead.lostReason`; `lossDealReason` existing jadi note | Dialog wajib saat drag ke lost_deal (reuse pattern stage-gate dialog); analytics distribution chart |
| Smart buttons | — | Badge counts (`_count`) + links di atas lead/client detail |

Urutan: probability config → weighted forecast → coverage ratio. Lost reason & smart buttons independen.

### Phase 2 — Activity Discipline & Collaboration (3–4 minggu)
Urutan internal ketat: **Activities → chatter → notifications** (tiap sub-fitur shippable terpisah).

| Fitur | Schema | Catatan |
|-------|--------|---------|
| Activities | `Activity` model (type call/email/meeting/todo/deadline, dueDate, status open/done/canceled, leadId/clientId, assignedTo) + `Lead.nextActivityAt` denormalized | Panel "Planned Activities" di detail; mark Done → prompt schedule next; nextActivityAt di-maintain di API layer (konsisten dgn pola stage gates) |
| Activity dot di kanban | — | grey=none, green=upcoming, orange=today, red=overdue; stale flag >7 hari tanpa open activity |
| My Activities view | — | Route `/activities`: grouped Overdue/Today/Upcoming, quick done/reschedule |
| Chatter panel | `Comment` (body, mentions[], leadId/clientId, soft delete) + `Follower` model. **History existing TIDAK dimigrasi — merge-at-read** | Komponen `RecordTimeline` merge 4 sumber (comments + LeadFieldHistory + LeadStageHistory + activities done); existing timeline components jadi renderer per item type; composer @mention pakai cmdk |
| Notification inbox | `Notification` model (type: mention/lead_assigned/activity_due/activity_overdue/alert/stage_change) | Bell di topbar + `/notifications`; mulai polling/fetch-on-focus, Realtime = enhancement nanti; mulai 3 trigger saja (anti-noise) |
| Command palette | — | Cmd+K: Navigate + Records (`/api/search` ILIKE) + Actions (New Lead/Activity/Client); `cmdk` package terinstall — verifikasi `command.tsx`, scaffold via `npx shadcn add command` jika belum ada |

### Phase 3 — Retention Engine & Polish (3–4 minggu)
| Fitur | Schema | Catatan |
|-------|--------|---------|
| Alert system | `Alert` model dgn **`dedupeKey` unique** (idempoten cron) | **Vercel Cron** → `/api/cron/alerts` (bukan pg_cron — testable, logic di app): T-60 "start renewal conversation" → auto-create Activity utk primary AE; T-30 escalation jika belum ada renewal lead → notify commercial_director. Gantikan renewal alert statis 90-hari |
| Renewal deal linking | `Lead.renewedFromLeadId` self-relation | Create renewal dari alert → auto-link + prefill; renewal chain di client detail; retention analytics jadi akurat (linkage eksplisit) |
| Health score v1 (proxy) | `ClientHealthSnapshot` (score, band, 4 signal proxy: activity recency 35%, renewal proximity 30%, revenue trend 20%, engagement 15%) | Cron mingguan; band = healthStatus existing (computed, overridable); label eksplisit "v1 (proxy)" + breakdown popover; band drop → Alert + Activity |
| Calendar view | — | `?view=calendar` di pipeline + `/activities` (grid custom ringan, bukan lib berat) |
| Inline list editing | — | Editable cells (stage, probability, closeDate, revenue) + optimistic update |
| Soft delete | `deletedAt` di Lead & Client + query helper filter | Archived filter + restore (admin) |
| Mobile pass + dark mode | — | Default `?view=list` di <md; kanban horizontal snap-scroll; sheet → full-screen drawer; prioritas 3 layar mobile: My Activities, lead detail, notifications; dark mode via next-themes |

## Keputusan Arsitektur Kunci

1. **Stage: HYBRID enum + SystemConfig, BUKAN migrasi ke master table.** Enum `PipelineStage` tetap (type safety penuh, zero migration risk pada Lead.stage/LeadStageHistory/semua switch-case); konfigurasi per-stage (probability, order, color) di `SystemConfig` JSON — reuse infra `GET/PUT /api/system-config/[key]` yang sudah ada. Promosi ke table hanya jika kelak butuh custom stages runtime.
2. **Chatter: parallel merge-at-read, BUKAN migrasi history.** LeadFieldHistory/StageHistory/ClientFieldHistory tetap; tabel baru hanya `Comment` + `Follower`.
3. **Cron: Vercel Cron** (route `/api/cron/*`), idempoten via `Alert.dedupeKey` unique.
4. **Kalibrasi probability dari data historis** `LeadStageHistory` (win rate aktual per stage), bukan angka default Odoo; tampilkan raw dan weighted berdampingan supaya dipercaya user.

## UI/UX Direction

- **Record detail** (anatomi Odoo): Breadcrumb → smart buttons row → header (nama + revenue + stage arrow-pill selector, tetap lewat stage-gate dialogs existing) → body 2 kolom (fields inline-edit kiri, Planned Activities + probability + key dates kanan) → RecordTimeline full-width bawah.
- **Kanban card**: nama+client / revenue+probability badge / closeDate color-coded / footer avatar AE + activity dot + doc icon.
- **View state**: hook `useViewState()` (wrapper useSearchParams) — `?view=&filter=&sort=&page=` shareable, back-button preserve context; per-user default view di `User.preferences` JSON.
- **Color convention universal** (token semantik di `src/lib/`): green=on-track/won, orange=due today/warning/T-60, red=overdue/lost/T-30/at-risk, grey=idle, purple=renewal.
- **Mobile**: list-first, bukan paksa kanban; use case mobile AE = follow-up, bukan data entry.

## User Journey Baru (Lead-to-Renewal)

1. Lead masuk (Cmd+K / form) → probability auto 10% → sistem langsung minta first activity → AE jadi follower.
2. Kerja harian AE mulai dari `/activities` (Overdue/Today/Upcoming), bukan scan kanban; Done → prompt next; stale >7 hari → flag + notif.
3. Proposal→Negotiation: stage gates existing tetap; probability 60% otomatis; director pantau coverage ratio.
4. Won: gate signed quotation; retainer → contract dates terisi, renewal clock mulai. Lost → wajib structured reason → analytics.
5. Delivery: health score mingguan (proxy v1); band turun → Alert + Activity ke AE.
6. T-60: Alert + auto Activity "start renewal conversation" → renewal lead linked (`renewedFromLeadId`) + prefill.
7. T-30: belum ada renewal lead → escalation ke commercial_director.
8. Renewal won → contract dates update, siklus ulang; renewal chain visible di client detail.

## Risiko & Mitigasi (top)

| Risiko | Mitigasi |
|--------|----------|
| No migrations history — `db push` destruktif | Phase 0 item #1: baseline prisma migrate |
| Migrasi enum stage merusak data | Dihindari by design (hybrid enum + SystemConfig) |
| Probability tidak dipercaya → forecast diabaikan | Kalibrasi dari win rate historis; tampilkan raw + weighted |
| Notification noise | Mulai 3 trigger; digest untuk activity_due |
| Health score terkesan asal (data terbatas) | Label "v1 (proxy)", breakdown transparan, manual override tetap ada |
| Regression tanpa test | Playwright smoke di Phase 0 sebelum fitur baru |

## Critical Files

- `execution/prisma/schema.prisma` — semua schema changes
- `execution/src/components/pipeline/pipeline-kanban.tsx` + `pipeline-card.tsx`
- `execution/src/components/pipeline/lead-detail-client.tsx`
- `execution/src/components/dashboard/dashboard-content.tsx`
- `execution/src/app/api/leads/route.ts`, `src/app/api/system-config/[key]/route.ts`
- Reuse: sheet form pattern, filter panel, drill-down drawer, stage-gate dialog, timeline components

## Deliverable & Verifikasi

Setelah approve:
1. Tulis PRD lengkap ke `outputs/vf-erp/PRD-erp-upgrade-odoo-lark.md` + update `_INDEX.md` (mandatory per CLAUDE.md).
2. Eksekusi per phase (delegasi ke Webo untuk implementasi, Wiux untuk design spec detail bila perlu), Veri QC tiap deliverable.
3. Verifikasi per phase: `npm run build` + TypeScript 0 error; Playwright smoke pass; manual test flow inti (create lead → drag stage → weighted forecast berubah di dashboard; T-60 cron dry-run di route `/api/cron/alerts?dryRun=1`).

**Catatan: implementasi BELUM dimulai — dokumen ini plan/PRD saja sesuai request.**
