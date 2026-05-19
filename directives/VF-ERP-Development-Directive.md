# VF ERP System — Development Directive

**Versi:** 1.0
**Tanggal:** 2026-05-18
**Author:** Opis — Operations & Systems Design, WAAT
**Berlaku untuk:** Oci (orchestrator), Webo (developer), William (owner)
**Dibaca sebelum:** Setiap dispatch ke Webo, setiap QC oleh Veri

---

## 1. Project Overview

### Apa ini dan untuk siapa

VF ERP System adalah internal tool untuk Divisi Commercial vosFoyer — VP Commercial, Account Manager (AM), Account Executive (AE), dan Busdev. Tool ini menggantikan spreadsheet dan WhatsApp thread sebagai sistem utama untuk tracking klien, pipeline deal, dan target revenue.

Dua fungsi utama Phase 1:
1. **CRM** — database klien aktif, kontrak, multiple PIC per klien, upsell opportunity, contract renewal tracking
2. **BizDev Pipeline** — Kanban board untuk leads dari Prospecting sampai Won/Lost, document gates, revenue target vs actual

### vosFoyer sebagai creative agency

vosFoyer adalah 360 creative agency dengan model Think → Build → Amplify. Tiga service pillar: Social Media Management (retainer), Corporate Training (project/retainer), Influencer & Campaign (project). Klien saat ini sebagian besar retainer dengan kontrak tahunan atau 6 bulan. Revenue model bergantung pada contract renewal dan upsell ke klien existing — bukan hanya acquisition baru.

Struktur commercial: VP Commercial membawahi dua department — Busdev (acquisition) dan Account (client management). Operation Director berada di luar lingkup sistem ini.

### Pain point yang jadi alasan proyek ini ada

1. **Tidak ada visibility pipeline** — tidak ada yang tahu deal mana yang sudah di stage mana, siapa yang sedang di-follow up, berapa estimasi revenue bulan depan
2. **Contract renewal kelewatan** — kontrak klien habis tanpa ada alert, renewal terlambat dikejar
3. **Dokumen berserakan** — quotation dan kontrak tersebar di email dan Google Drive tanpa sistem tracking
4. **Target vs actual tidak terlihat** — tim commercial tidak punya view tunggal untuk revenue target vs pencapaian aktual
5. **PIC klien tidak terdokumentasi** — satu klien punya banyak kontak (finance, marketing, director) tapi tidak ada tempat centralnya

---

## 2. Scope dan Out of Scope

### Phase 1 — yang dibangun sekarang

- CRM: client database, multiple contacts per client, contract detail, upsell tracking
- BizDev Pipeline: Kanban + list view, stage gates, document upload, billing plan, quarter tracking
- Dashboard: revenue vs target, contract expiry alerts, pipeline summary, client health
- Targets: set dan track monthly/quarterly revenue target
- Analytics: win rate per AE dan per industry, revenue trend, client retention
- Auth dan role-based access control
- Settings: user management (admin only)

### Out of scope (tidak dibangun sekarang)

- **PM Tool** — sudah ter-handle oleh n8n + Discord + Google Sheets. VF ERP tidak replace ini.
- **HRM** — Phase 2. Belum di-scope.
- **Finance & Accounting** — Phase 3. Belum di-scope.
- **Client-facing portal** — tidak ada. Tool ini internal only.
- **Integrasi dengan tools lain** — tidak ada API integration di Phase 1.
- **Email/WhatsApp integration** — tidak ada.

### Phase Roadmap

**Phase 1 — CRM + BizDev Pipeline (scope saat ini)**
Selesai ketika semua 12 klien aktif bisa diinput, pipeline Luno dan Bakmi GM bisa di-track, gates dokumen berjalan, dan dashboard revenue aktif. Target: deployed ke Vercel + Supabase.

**Phase 2 — HRM**
Human Resource Management: onboarding karyawan, kontrak kerja, attendance, leave management. Akan di-scope setelah Phase 1 live dan dipakai minimal 1 bulan.

**Phase 3 — Finance**
Invoice management, billing schedule, receivables tracking, revenue reconciliation. Akan di-scope setelah Phase 2 live.

---

## 3. Tech Stack

Semua keputusan stack sudah final. Tidak ada alternatif yang perlu dipertimbangkan ulang.

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| Language | TypeScript strict mode |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| ORM | Prisma |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| Drag-and-drop (Kanban) | @dnd-kit |
| Charts | Recharts |
| Animations | Framer Motion |
| File upload (document zones) | React Dropzone |
| Hosting — frontend | Vercel |
| Hosting — database + auth | Supabase |

Design system sudah selesai. Seluruh token warna, tipografi, spacing, component spec, dan page layout ada di `outputs/design-system-spec.md`. Webo wajib baca ini sebelum mulai implementasi — jangan invent design decisions sendiri.

---

## 4. Role System

### Tabel akses

| Role | CRM | Pipeline | Dashboard | Targets | Analytics | Settings |
|------|-----|----------|-----------|---------|-----------|----------|
| `admin` | Full | Full | Full | Edit | Full | Ya |
| `account` | Full | Full | Full | Read | Full | Tidak |
| `operation` | Read-only | Read-only | Read-only | Read | Read | Tidak |
| `hr` | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak (Phase 2) |
| `finance` | Tidak | Tidak | Read | Read | Read | Tidak (Phase 3) |

### Aturan tambahan

- **VP Commercial** menggunakan role `account`. VP Commercial dapat melihat semua pipeline tanpa filter pembatasan per AE — tidak ada scope restriction berdasarkan assigned_to untuk role ini. Implementasi: jika user adalah VP Commercial (atau flag khusus di user record), skip filter `assigned_to = user.id` pada query pipeline.
- **Admin** adalah satu-satunya role yang bisa akses `/settings`. Route `/settings` harus redirect ke `/dashboard` jika role bukan `admin`.
- **Admin** adalah satu-satunya yang bisa edit revenue targets.
- AE biasa (`account`) hanya melihat pipeline yang di-assign ke dirinya kecuali VP Commercial flag aktif.

---

## 5. Data Models — Phase 1

Semua model di bawah sudah final. Tidak ada perubahan struktur tanpa konfirmasi William.

### users

```
id              uuid, PK
name            text, not null
email           text, unique, not null
role            enum(admin|account|operation|hr|finance), not null
division        text
is_active       boolean, default true
is_vp           boolean, default false   -- flag untuk VP Commercial pipeline visibility
created_at      timestamp
```

### clients

```
id                uuid, PK
name              text, not null
industry          text
engagement_type   enum(retainer|project|both), not null
                  -- Tipe keterlibatan klien secara keseluruhan (bukan per-deal)
                  -- "both" = klien yang punya retainer DAN project sekaligus (misal: IDX retainer + project adhoc)
contract_start    date
contract_end      date
monthly_value     numeric(15,2)
annual_value      numeric(15,2)
health_status     enum(healthy|at_risk|churned), default 'healthy'
primary_ae        uuid, FK → users.id
notes             text
created_at        timestamp
updated_at        timestamp
```

### contacts

```
id          uuid, PK
client_id   uuid, FK → clients.id, not null
name        text, not null
role        text              -- jabatan PIC: "Marketing Manager", "Finance", "Director"
email       text
phone       text
is_primary  boolean, default false
created_at  timestamp
```

Catatan: satu klien bisa punya banyak PIC (one-to-many). Contoh: klien IDX mungkin punya kontak Marketing Manager, Finance PIC, dan VP/Director. Semua tersimpan di tabel ini, bukan di tabel clients.

### upsell_opportunities

```
id                uuid, PK
client_id         uuid, FK → clients.id, not null
service           text, not null
status            enum(identified|pitched|won|lost), default 'identified'
estimated_value   numeric(15,2)
notes             text
created_at        timestamp
```

### leads

```
id                uuid, PK
company_name      text, not null
industry          text
source            text
stage             enum(prospecting|pitched|negotiating|contract_renewal|won|lost), not null
project_type      enum(one_time|retainer), not null
                  -- Tipe per-deal di pipeline. BERBEDA dari clients.engagement_type.
                  -- "one_time" = project selesai dan tutup. "retainer" = ongoing bulanan.
client_category   enum(new_client|renewal), not null
estimated_value   numeric(15,2)
billing_plan      text             -- format YYYY-MM, misal "2026-07"
quarter           enum(Q1|Q2|Q3|Q4)
assigned_to       uuid, FK → users.id
created_at        timestamp
closed_at         timestamp        -- diisi ketika stage = won atau lost
notes             text
```

### pipeline_documents

```
id              uuid, PK
lead_id         uuid, FK → leads.id, not null
type            enum(quotation|quotation_signed|contract|other), not null
file_url        text, not null
uploaded_at     timestamp
uploaded_by     uuid, FK → users.id
```

### pitches

```
id                uuid, PK
lead_id           uuid, FK → leads.id, nullable
client_id         uuid, FK → clients.id, nullable
service           text, not null
submitted_date    date
estimated_value   numeric(15,2)
outcome           enum(pending|won|lost), default 'pending'
decision_date     date
notes             text
```

Catatan: `lead_id` dan `client_id` keduanya nullable karena pitch bisa untuk new lead (belum jadi client) atau untuk existing client (upsell pitch). Minimal satu dari keduanya harus diisi — enforce di application level, bukan hanya DB constraint.

### targets

```
id                uuid, PK
period_month      integer          -- 1–12
period_year       integer
revenue_target    numeric(15,2)
new_client_target integer
type              enum(monthly|quarterly), not null
created_at        timestamp
updated_at        timestamp
```

---

## 6. Business Rules dan Document Gates

Ini adalah aturan yang di-enforce di application level, bukan hanya UI hint. Stage transition harus divalidasi server-side.

### Gate 1 — Advance ke `pitched`

Kondisi: lead di stage `prospecting` ingin maju ke `pitched`.

Validasi yang harus lulus: ada minimal satu `pipeline_documents` record untuk `lead_id` ini dengan `type = 'quotation'`.

Artinya: **quotation (unsigned)** sudah dikirim ke klien sebagai dokumen awal penawaran. Dokumen ini adalah quotation pertama yang dikirim — bukan versi final yang ditandatangani.

Jika belum ada → system menolak stage advance, tampilkan pesan: "Upload quotation terlebih dahulu sebelum advance ke Pitched."

### Gate 2 — Advance ke `won`

Kondisi: lead di stage manapun (pitched/negotiating/contract_renewal) ingin maju ke `won`.

Validasi yang harus lulus: ada minimal satu `pipeline_documents` record untuk `lead_id` ini dengan `type = 'quotation_signed'`.

Artinya: **signed quotation** (dokumen yang sudah ditandatangani klien sebagai final approval) sudah di-upload.

Jika belum ada → system menolak stage advance, tampilkan pesan: "Upload signed quotation terlebih dahulu sebelum mark Won."

### Intermediate stages bebas

Transisi antara `pitched`, `negotiating`, dan `contract_renewal` tidak memerlukan dokumen tambahan. Tim bisa advance bebas di antara stage ini.

### Stage history

Setiap perubahan stage harus dicatat — timestamp, stage sebelumnya, stage baru, user yang melakukan perubahan. Ini ditampilkan di `/pipeline/[id]` sebagai timeline.

---

## 7. Confirmed Decisions

Semua keputusan di bawah sudah final. Jangan dibuka ulang sebagai opsi — langsung implementasi.

| # | Topik | Keputusan |
|---|-------|-----------|
| 1 | Build approach | Custom build. Odoo hanya sebagai referensi model mental, tidak ada API dependency atau integrasi Odoo sama sekali |
| 2 | Client ke Contact | One-to-many. Satu klien bisa punya banyak PIC di tabel `contacts` terpisah |
| 3 | VP Commercial visibility | Bisa lihat semua pipeline tanpa filter AE. Implementasi via flag `is_vp` di tabel users |
| 4 | Format currency | Full format di semua views: "Rp 847.000.000" — titik sebagai thousand separator, tanpa abbreviasi (tidak ada "Rp 847 jt" atau "Rp 0.8M") |
| 5 | Definisi quarter | Calendar year: Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Okt–Des |
| 6 | Project type | Dua nilai saja: `one_time` dan `retainer` |
| 7 | Document gate | Gate 1: quotation unsigned wajib ada sebelum advance ke Pitched. Gate 2: signed quotation wajib ada sebelum mark Won |
| 8 | Deployment | Vercel untuk frontend, Supabase untuk database dan auth |
| 9 | PM Tool | Out of scope. n8n + Discord + Google Sheets tetap dipakai untuk project management, tidak di-replace |

---

## 8. Page Structure — Phase 1

Semua halaman di bawah adalah scope Phase 1. Tidak ada halaman lain yang perlu dibuat.

### /dashboard

Konten:
- Revenue actual vs target bulan ini (angka + progress bar)
- Revenue actual vs target quarter ini (angka + progress bar)
- Expiring contracts alert: klien dengan `contract_end` dalam 30, 60, 90 hari ke depan — ditampilkan sebagai chip/badge dengan warna severity (30 hari = danger, 60 hari = warning, 90 hari = info)
- Active pipeline value (total `estimated_value` dari semua lead yang belum Won/Lost)
- Pipeline stage breakdown (berapa leads di tiap stage)
- Client health breakdown (berapa healthy/at_risk/churned)
- Win rate bulan ini

### /clients

Konten:
- List semua klien aktif (`is_active = true` secara efektif berdasarkan health_status dan contract)
- Search by nama
- Filter by: health_status, industry, primary_ae
- Setiap row menampilkan: nama, industry, engagement_type, contract_end, health_status badge, primary AE

### /clients/[id]

Konten:
- Header: nama klien, industry, health badge
- Section Kontrak: engagement_type, contract_start, contract_end, monthly_value, annual_value
- Section Contacts: list semua PIC (nama, jabatan, email, phone), dengan indicator siapa is_primary. Bisa tambah PIC baru.
- Section Upsell Opportunities: list upsell dengan status badge. Bisa tambah opportunity baru.
- Notes

### /pipeline

Konten:
- Default view: Kanban board dengan 5 kolom — Prospecting | Pitched | Negotiating | Contract Renewal | Won/Lost
- Toggle ke List view
- Filter by: assigned_to, quarter, project_type, client_category
- Setiap card di Kanban menampilkan: company name, estimated value (full format Rp), project type badge, AE assigned, quarter

Catatan untuk Webo: drag-and-drop antar kolom menggunakan @dnd-kit. Stage advance via drag harus tetap melalui gate validation — jika gate belum terpenuhi, snap back ke posisi semula dan tampilkan error message.

### /pipeline/[id]

Konten:
- Header: company name, stage badge, assigned AE
- Detail fields: project_type, client_category, estimated_value, billing_plan, quarter
- Document Upload Zones: dua zone terpisah — "Upload Quotation" dan "Upload Signed Quotation". Setiap zone menampilkan status (belum upload / sudah upload + tanggal + uploader). Sudah-upload zone bisa add versi baru.
- Stage advance button: jika Gate belum terpenuhi, button disabled dengan tooltip penjelasan
- Stage History timeline: urutan stage changes dari pertama sampai sekarang
- Notes

### /targets

Konten:
- Filter: per bulan atau per quarter
- Form set target: period (bulan/tahun atau quarter), revenue_target, new_client_target
- View pencapaian: target vs actual side-by-side dengan delta (over/under) dan percentage achievement
- Tabel per bulan dalam quarter yang dipilih

Akses: hanya admin yang bisa set/edit target. Role lain read-only.

### /analytics

Konten:
- Win rate per AE (tabel + bar chart)
- Win rate per industry (tabel + bar chart)
- Revenue trend bulan ke bulan (line chart, 12 bulan ke belakang)
- Client retention rate (klien yang renew vs tidak renew dari total kontrak yang jatuh tempo)

### /settings

Konten (MVP):
- User management: list semua users, bisa tambah user baru, edit role, deactivate user
- Pipeline settings: label stage (jika ingin di-customize — MVP bisa skip dulu)

Akses: `/settings` hanya bisa diakses role `admin`. Jika role bukan admin → redirect ke `/dashboard`.

---

## 9. Agent Dispatch Sequence

### Status pekerjaan sampai hari ini

**Selesai:**
- Planning dan confirmed decisions — semua ada di directive ini
- Wiux: Design system spec → `outputs/design-system-spec.md` (versi final, Veri sudah QC — CONDITIONAL PASS, semua corrections sudah diapply)
- Opis: SOP onboarding tim vosFoyer → `outputs/SOP-ERP-Onboarding-vosFoyer.md`
- Veri: QC design spec (CONDITIONAL PASS — corrections diapply oleh Wiux sebelum finalisasi)

**Pending — menunggu aksi William:**

**[ACTION REQUIRED: William]** Setup Supabase project:
1. Buat project baru di supabase.com
2. Catat `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari project settings
3. Simpan ke `.env` file di root repo ini:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
   DATABASE_URL=postgresql://[credentials]
   ```
4. Informasikan ke Oci bahwa Supabase sudah ready — ini adalah trigger untuk dispatch Webo

**Pending — menunggu Supabase ready:**
- Webo: Phase 1 implementation (Next.js + Supabase + Prisma). Dispatch hanya setelah `.env` sudah terisi.
- Veri: QC Phase 1 implementation setelah Webo selesai

**Belum di-scope (akan di-plan setelah Phase 1 live):**
- Phase 2 — HRM
- Phase 3 — Finance

### Sequence dispatch setelah Supabase ready

```
William setup Supabase → konfirmasi ke Oci
    |
Oci dispatch Webo (Phase 1 implementation)
    |
Webo selesai → Oci dispatch Veri (QC implementation)
    |
Veri QC report → Oci deliver ke William
    |
    PASS → Phase 1 live
    CONDITIONAL PASS → Webo fix corrections → Veri re-QC
    REJECT → William decide next step
```

### Brief untuk Webo saat dispatch

Wajib di-include dalam dispatch brief ke Webo:
- Baca directive ini secara penuh
- Baca `outputs/design-system-spec.md` (design tokens, component specs, page layouts, shadcn overrides)
- Baca `outputs/SOP-ERP-Onboarding-vosFoyer.md` (untuk memahami use cases nyata tim vosFoyer)
- Data models ada di Section 5 directive ini — gunakan exact field names dan enum values
- Business rules ada di Section 6 — Gates harus di-enforce server-side, bukan hanya UI
- Verified decisions ada di Section 7 — tidak perlu ditanyakan ulang
- Check `outputs/_SWARM/skills/` untuk relevant skill files sebelum mulai

---

## 10. Verification Checklist — Phase 1 Done When

Ini adalah acceptance criteria. Phase 1 dinyatakan selesai ketika semua item di bawah terpenuhi. Veri menggunakan checklist ini untuk QC.

### CRM

- [ ] 12 existing clients bisa diinput dengan semua field: name, industry, engagement_type, contract_start, contract_end, monthly_value, annual_value, health_status, primary_ae, notes
- [ ] Satu klien bisa punya lebih dari satu contact (PIC) dengan field: nama, role/jabatan, email, phone, is_primary
- [ ] Client health status bisa diset per klien: healthy / at_risk / churned
- [ ] Upsell opportunity bisa ditambahkan ke existing client dengan field: service, status, estimated_value, notes

### Dashboard

- [ ] Contract renewal alerts muncul untuk kontrak yang expiring dalam 30 hari, 60 hari, dan 90 hari ke depan — dengan severity visual yang berbeda
- [ ] Dashboard menampilkan revenue actual vs target — bulan ini dan quarter ini
- [ ] Pipeline summary tersedia: total active pipeline value, breakdown per stage, win rate bulan ini
- [ ] Client health breakdown terlihat: jumlah healthy/at_risk/churned

### Pipeline

- [ ] Lead Luno dan Bakmi GM bisa diinput dan di-track di pipeline
- [ ] Stage `contract_renewal` tersedia untuk klien existing yang masuk fase renewal
- [ ] Billing Plan field (format YYYY-MM) bisa diinput per lead → dashboard bisa hitung monthly billing forecast
- [ ] Quarter field bisa diisi (Q1/Q2/Q3/Q4) per lead
- [ ] Project type (one_time / retainer) bisa ditandai per lead
- [ ] Client category (new_client / renewal) bisa ditandai per lead
- [ ] Gate 1 berjalan: advance ke stage `pitched` diblokir jika belum ada quotation (unsigned) di-upload
- [ ] Gate 2 berjalan: advance ke `won` diblokir jika belum ada signed quotation di-upload
- [ ] Stage history tercatat per lead — timestamp + siapa yang ubah
- [ ] Drag-and-drop di Kanban board berfungsi, gate validation tetap berlaku saat drag

### Analytics dan Targets

- [ ] Win rate terhitung per AE
- [ ] Win rate terhitung per industry
- [ ] Revenue target bisa diset per bulan dan per quarter (admin only)
- [ ] Revenue actual vs target bisa dilihat dengan delta dan percentage

### Auth dan Roles

- [ ] Role-based access berjalan: role `operation` tidak bisa edit di CRM atau Pipeline
- [ ] `/settings` hanya bisa diakses role `admin` — role lain di-redirect ke `/dashboard`
- [ ] VP Commercial (flag `is_vp = true`) bisa lihat semua pipeline tanpa filter AE
- [ ] AE biasa hanya melihat leads yang di-assign ke dirinya

### Display

- [ ] Currency tampil sebagai full format "Rp X.XXX.XXX" di semua views — tidak ada abbreviated format

### Deployment

- [ ] Deployed ke Vercel dan accessible via URL
- [ ] Supabase project aktif dan database terhubung
- [ ] Auth (login/logout) berfungsi

---

## 11. File References

Semua file pendukung yang relevan untuk implementasi:

| File | Lokasi | Isi |
|------|--------|-----|
| Design system spec | `outputs/design-system-spec.md` | Color tokens, typography, spacing, 10 component specs, 8 page layout specs, shadcn/ui overrides (`globals.css`, `tailwind.config.ts`, `components.json`), motion specs |
| SOP onboarding vosFoyer | `outputs/SOP-ERP-Onboarding-vosFoyer.md` | Panduan setup awal, data entry guide, role guide, FAQ — untuk memahami workflow nyata user |
| vosFoyer context | `directives/vosFoyer context/` | 7 file: About vosFoyer, Positioning, Org Structure, Clients, Plan 2026, VF Playbook, Context dump — baca ini untuk memahami bisnis |
| ERP knowledge base | `directives/ERP — Enterprise Resource Planning Comprehensive Knowledge Base.md` | Referensi konsep ERP |
| Work log | `outputs/_WORKLOG.md` | Histori progress project |

---

## 12. Catatan untuk Webo

Beberapa hal yang harus diperhatikan saat implementasi agar tidak perlu bolak-balik tanya:

**Numeric display:** Semua angka uang menggunakan `font-variant-numeric: tabular-nums` (sudah ada di design system). Format Rupiah: gunakan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })` — ini menghasilkan "Rp 847.000.000" sesuai konvensi.

**Gate validation:** Validasi Gate 1 dan Gate 2 harus terjadi di server-side (API route atau server action), bukan hanya di client. User tidak boleh bisa bypass gate dengan memanipulasi request.

**Kanban snap-back:** Jika user drag Kanban card ke kolom yang trigger gate dan gate tidak terpenuhi — card harus snap back ke posisi semula dan tampilkan toast error. Jangan biarkan card landing di kolom yang tidak valid.

**VP Commercial flag:** Jangan hardcode berdasarkan nama. Gunakan field `is_vp` di tabel users. Admin yang set flag ini via `/settings`.

**Stage history:** Setiap stage change perlu disimpan — bisa dengan tabel terpisah `lead_stage_history` (lead_id, from_stage, to_stage, changed_by, changed_at) atau dengan Supabase audit log. Pilih yang paling bersih untuk di-query.

**Currency di database:** Simpan sebagai `numeric(15,2)` — bukan integer, bukan text. Formatting hanya terjadi di display layer.

**Prisma schema:** Generate dari data models di Section 5. Semua enum harus match persis — case-sensitive.
