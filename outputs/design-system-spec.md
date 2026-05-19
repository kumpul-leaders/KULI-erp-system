# VF ERP System — Design System Spec
**Version:** 1.0
**Date:** 2026-05-18
**Author:** Wiux — Web Interface & User Experience, WAAT
**Handoff to:** Webo
**Project:** vosFoyer Internal CRM + BizDev Pipeline Tool
**Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui

---

## 0. Design Mode Identification

**Mode:** Clean Minimal SaaS — Internal Tool variant

**Rationale:** Tim Commercial vosFoyer (VP Commercial, AE, AM, Admin) adalah power users yang akan berinteraksi dengan tool ini setiap hari. Mental model yang tepat adalah Linear / Vercel Dashboard / Notion — typographic hierarchy, negative space yang cukup untuk density informasi tinggi, semantic color encoding yang predictable, dan motion yang tidak mengalihkan perhatian. Tool ini bukan untuk impress klien; ia untuk membantu tim commercial vosFoyer menutup deal dan manage relationship dengan kepala dingin.

**NOT:** Consumer SaaS, tidak perlu hero section, tidak perlu illustrations, tidak perlu gradients sebagai focal point. Agency premium posture tercermin dari precision dan kejelasan — bukan dari dekorasi.

---

## 1. Color Palette

### 1.1 Design Decisions

Anchor: slate gray scale sebagai neutral base — bukan pure gray (terlalu cold) dan bukan warm gray murni. Slate memiliki blue undertone ringan yang terasa sophisticated dan professional, sangat sesuai untuk internal tool di creative agency mid-premium. Accent: satu accent color yang purposeful — Indigo. Alasan: Indigo secara psikologis membawa trust + authority + clarity. Tidak playful, tidak aggressive. Dipakai untuk interactive elements, CTAs, selected states.

Status colors mengikuti semantic convention yang universal (red/amber/green/blue) — user harus bisa membaca health indicator tanpa mental translation.

### 1.2 Color Token Definitions

Semua token di bawah menggunakan semantic naming. Nilai CSS custom properties di-define di `globals.css`, dikonsumsi oleh Tailwind config.

#### Neutral Scale (Slate Base)

| Token Name | CSS Variable | Hex Value | Usage |
|---|---|---|---|
| `neutral-0` | `--color-neutral-0` | `#FFFFFF` | Page background |
| `neutral-50` | `--color-neutral-50` | `#F8FAFC` | Sidebar background, table alternating row |
| `neutral-100` | `--color-neutral-100` | `#F1F5F9` | Card background, hover surface |
| `neutral-200` | `--color-neutral-200` | `#E2E8F0` | Dividers, input borders (default) |
| `neutral-300` | `--color-neutral-300` | `#CBD5E1` | Disabled borders, placeholder text |
| `neutral-400` | `--color-neutral-400` | `#94A3B8` | Muted text, icon inactive |
| `neutral-500` | `--color-neutral-500` | `#64748B` | Body text secondary |
| `neutral-600` | `--color-neutral-600` | `#475569` | Body text primary |
| `neutral-700` | `--color-neutral-700` | `#334155` | Heading text |
| `neutral-800` | `--color-neutral-800` | `#1E293B` | Page title, heavy heading |
| `neutral-900` | `--color-neutral-900` | `#0F172A` | Maximum contrast text |

#### Accent — Indigo

| Token Name | CSS Variable | Hex Value | Usage |
|---|---|---|---|
| `accent-50` | `--color-accent-50` | `#EEF2FF` | Accent surface, selected row background |
| `accent-100` | `--color-accent-100` | `#E0E7FF` | Chip/badge background (active state) |
| `accent-200` | `--color-accent-200` | `#C7D2FE` | Accent border, focus ring fill |
| `accent-500` | `--color-accent-500` | `#6366F1` | Primary CTA background, active nav item indicator |
| `accent-600` | `--color-accent-600` | `#4F46E5` | CTA hover state |
| `accent-700` | `--color-accent-700` | `#4338CA` | CTA active/pressed state |
| `accent-foreground` | `--color-accent-foreground` | `#FFFFFF` | Text on accent-500 background |

#### Semantic — Status Colors

| Token Name | CSS Variable | Hex Value | Usage |
|---|---|---|---|
| `success-50` | `--color-success-50` | `#F0FDF4` | Success surface background |
| `success-500` | `--color-success-500` | `#22C55E` | Success icon, dot indicator |
| `success-700` | `--color-success-700` | `#15803D` | Success text on light background |
| `warning-50` | `--color-warning-50` | `#FFFBEB` | Warning surface background |
| `warning-500` | `--color-warning-500` | `#F59E0B` | Warning icon, dot indicator |
| `warning-700` | `--color-warning-700` | `#B45309` | Warning text on light background |
| `danger-50` | `--color-danger-50` | `#FFF1F2` | Danger surface background |
| `danger-500` | `--color-danger-500` | `#EF4444` | Danger icon, dot indicator, error state |
| `danger-700` | `--color-danger-700` | `#B91C1C` | Danger text on light background |
| `info-50` | `--color-info-50` | `#EFF6FF` | Info surface background |
| `info-500` | `--color-info-500` | `#3B82F6` | Info icon, informational badge |
| `info-700` | `--color-info-700` | `#1D4ED8` | Info text on light background |

#### Surface & Border Semantic Aliases

| Token Name | Maps To | Purpose |
|---|---|---|
| `bg-page` | `neutral-0` | Root page background |
| `bg-surface` | `neutral-50` | Sidebar, secondary panel |
| `bg-card` | `neutral-0` | Card, panel, modal background |
| `bg-hover` | `neutral-100` | Row hover, button hover background |
| `bg-selected` | `accent-50` | Selected row, active state background |
| `border-default` | `neutral-200` | Default divider, input border |
| `border-strong` | `neutral-300` | Stronger separator |
| `border-focus` | `accent-500` | Input focus ring |
| `text-primary` | `neutral-800` | Headings, primary labels |
| `text-secondary` | `neutral-500` | Body text, descriptions |
| `text-muted` | `neutral-400` | Placeholder, disabled text |
| `text-inverse` | `neutral-0` | Text on dark/accent background |

### 1.3 Status Color Mapping — Domain Specific

#### Client Health Status

| Status | Background | Text | Border | Dot |
|---|---|---|---|---|
| Healthy | `success-50` (#F0FDF4) | `success-700` (#15803D) | none | `success-500` (#22C55E) |
| At-Risk | `warning-50` (#FFFBEB) | `warning-700` (#B45309) | none | `warning-500` (#F59E0B) |
| Churned | `danger-50` (#FFF1F2) | `danger-700` (#B91C1C) | none | `danger-500` (#EF4444) |

#### Pipeline Stage Colors

| Stage | Background | Text | Rationale |
|---|---|---|---|
| Prospecting | `neutral-100` (#F1F5F9) | `neutral-600` (#475569) | Netral — belum ada komitmen |
| Pitched | `info-50` (#EFF6FF) | `info-700` (#1D4ED8) | Informational — sudah engage |
| Negotiating | `warning-50` (#FFFBEB) | `warning-700` (#B45309) | Amber — butuh perhatian, aktif |
| Contract Renewal | `accent-50` (#EEF2FF) | `accent-700` (#4338CA) | Accent — high value action |
| Won | `success-50` (#F0FDF4) | `success-700` (#15803D) | Green — closed positive |
| Lost | `danger-50` (#FFF1F2) | `danger-700` (#B91C1C) | Red — closed negative |

#### Contract Expiry Urgency

| Urgency | Condition | Background | Text | Border-left |
|---|---|---|---|---|
| Critical | Expiring ≤ 30 days | `danger-50` (#FFF1F2) | `danger-700` (#B91C1C) | `danger-500` (#EF4444), 3px solid |
| Warning | Expiring 31–60 days | `warning-50` (#FFFBEB) | `warning-700` (#B45309) | `warning-500` (#F59E0B), 3px solid |
| Notice | Expiring 61–90 days | `info-50` (#EFF6FF) | `info-700` (#1D4ED8) | `info-500` (#3B82F6), 3px solid |
| None | > 90 days | no highlight | `neutral-600` | none |

---

## 2. Typography Scale

### 2.1 Font Family

**Primary:** Inter — geometric sans-serif, screen-optimized, excellent numeric tabular rendering. Ideal untuk dashboard dengan banyak angka (revenue, pipeline value, win rate).

**Monospace (KPI numbers, metrics):** JetBrains Mono atau Inter tabular variant via `font-variant-numeric: tabular-nums` — semua angka di KPI card dan tabel harus monospace/tabular agar kolom align.

```css
/* globals.css — font-face */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.font-mono-numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

### 2.2 Type Scale

| Role | Size | Weight | Line Height | Letter Spacing | Tailwind Class | Usage |
|---|---|---|---|---|---|---|
| Page Title | 24px / 1.5rem | 700 | 1.2 (32px) | -0.02em | `text-2xl font-bold tracking-tight leading-tight` | H1 — page header (Dashboard, Clients, Pipeline) |
| Section Title | 18px / 1.125rem | 600 | 1.3 | -0.01em | `text-lg font-semibold tracking-tight` | H2 — section header, card title |
| Subsection | 14px / 0.875rem | 600 | 1.4 | 0 | `text-sm font-semibold` | H3 — table column header, sidebar group label |
| Body Default | 14px / 0.875rem | 400 | 1.5 (21px) | 0 | `text-sm font-normal` | Standard body text, form labels, descriptions |
| Body Strong | 14px / 0.875rem | 500 | 1.5 | 0 | `text-sm font-medium` | Emphasized inline text, row names |
| Caption | 12px / 0.75rem | 400 | 1.4 | 0.01em | `text-xs font-normal tracking-wide` | Helper text, timestamps, metadata |
| Label / Badge | 11px / 0.6875rem | 600 | 1 | 0.04em | `text-[11px] font-semibold uppercase tracking-wider` | Status badges, column tags, stage labels |
| KPI Metric | 32px / 2rem | 700 | 1 | -0.03em | `text-4xl font-bold tracking-tight tabular-nums` | Dashboard KPI value (e.g., "Rp 847.000.000") |
| KPI Sub-metric | 14px / 0.875rem | 500 | 1.3 | 0 | `text-sm font-medium` | KPI card secondary value, trend % |
| Nav Item | 13px / 0.8125rem | 500 | 1 | 0 | `text-[13px] font-medium` | Sidebar navigation label |

### 2.3 Notes

- **Numeric rendering:** Semua angka currency, persentase, dan count di tabel dan KPI card harus menggunakan `font-variant-numeric: tabular-nums` — apply via class `tabular-nums` (sudah tersedia di Tailwind v3+).
- **No body text below 12px** — untuk aksesibilitas dan readability di layar retina dan non-retina.
- **Heading hierarchy harus konsisten per page** — satu H1 (page title), beberapa H2 (section), H3 hanya untuk sub-grouping dalam section.

---

## 3. Spacing System

Tailwind default spacing scale (4px base, 4-unit increment) sudah sufficient. Tidak ada custom spacing scale yang diperlukan. Berikut mapping spesifik untuk komponen utama:

### 3.1 Spacing Conventions

| Context | Value | Tailwind |
|---|---|---|
| Page padding (horizontal) | 32px | `px-8` |
| Page padding (top) | 24px | `pt-6` |
| Section gap (between sections) | 32px | `gap-8` or `mb-8` |
| Card padding | 20px | `p-5` |
| Card padding (compact) | 16px | `p-4` |
| Card gap (between cards in a row) | 16px | `gap-4` |
| Table row padding (vertical) | 12px | `py-3` |
| Table row padding (horizontal) | 16px | `px-4` |
| Table cell gap | 8px | `gap-2` |
| Form field gap (vertical stacking) | 16px | `space-y-4` |
| Form label margin-bottom | 6px | `mb-1.5` |
| Input padding | 8px 12px | `py-2 px-3` |
| Sidebar width | 240px | `w-60` |
| Sidebar item padding | 8px 12px | `py-2 px-3` |
| Sidebar item gap | 2px | `gap-0.5` |
| Badge padding | 2px 8px | `py-0.5 px-2` |
| Modal padding | 24px | `p-6` |
| Topbar height | 56px | `h-14` |
| KPI card min-height | 120px | `min-h-[120px]` |

### 3.2 Border Radius

| Context | Value | Tailwind |
|---|---|---|
| Default component (card, input, dropdown) | 8px | `rounded-lg` |
| Small component (badge, chip) | 4px | `rounded` |
| Button | 6px | `rounded-md` |
| Modal / Sheet | 12px | `rounded-xl` |
| Avatar | 50% | `rounded-full` |
| Kanban card | 8px | `rounded-lg` |
| Toast / notification | 8px | `rounded-lg` |
| Full pill (toggle, certain badges) | 9999px | `rounded-full` |

### 3.3 Shadow System

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)` | `shadow-sm` | Default card elevation |
| `shadow-card-hover` | `0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)` | `shadow-md` | Card on hover |
| `shadow-modal` | `0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)` | `shadow-xl` | Modal, sheet, popover |
| `shadow-dropdown` | `0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)` | `shadow-md` | Dropdown menu |
| `shadow-kanban` | `0 1px 3px 0 rgb(0 0 0 / 0.08)` | `shadow-sm` | Kanban card resting |
| `shadow-kanban-drag` | `0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)` | `shadow-lg` | Kanban card saat drag |

---

## 4. Component Specs

### 4.1 Status Badge

**Base shadcn/ui component:** `Badge` dari shadcn/ui — override variants.

**Purpose:** Menampilkan status client health, pipeline stage, project type, contract urgency. Dibaca sekilas — harus instant.

**Structure:**
```
[dot 6px] [label text 11px uppercase semibold]
```

**Padding:** `py-0.5 px-2` (2px 8px)
**Border radius:** `rounded` (4px)
**Gap (dot ke label):** `gap-1.5` (6px)

#### States

| Variant | Background | Text Color | Dot Color | Tailwind Classes |
|---|---|---|---|---|
| Healthy | `#F0FDF4` | `#15803D` | `#22C55E` | `bg-green-50 text-green-700` |
| At-Risk | `#FFFBEB` | `#B45309` | `#F59E0B` | `bg-amber-50 text-amber-700` |
| Churned | `#FFF1F2` | `#B91C1C` | `#EF4444` | `bg-red-50 text-red-700` |
| Prospecting | `#F1F5F9` | `#475569` | `#94A3B8` | `bg-slate-100 text-slate-600` |
| Pitched | `#EFF6FF` | `#1D4ED8` | `#3B82F6` | `bg-blue-50 text-blue-700` |
| Negotiating | `#FFFBEB` | `#B45309` | `#F59E0B` | `bg-amber-50 text-amber-700` |
| Contract Renewal | `#EEF2FF` | `#4338CA` | `#6366F1` | `bg-indigo-50 text-indigo-700` |
| Won | `#F0FDF4` | `#15803D` | `#22C55E` | `bg-green-50 text-green-700` |
| Lost | `#FFF1F2` | `#B91C1C` | `#EF4444` | `bg-red-50 text-red-700` |

**Dot implementation:**
```html
<span class="inline-flex items-center gap-1.5 rounded py-0.5 px-2 text-[11px] font-semibold uppercase tracking-wider bg-green-50 text-green-700">
  <span class="h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
  Healthy
</span>
```

**No border** — background contrast sudah sufficient. Border akan add visual noise di tabel yang dense.

**Hover state:** None — badge adalah read-only indicator, bukan interactive.

---

### 4.2 KPI Card

**Base shadcn/ui component:** Custom — bukan shadcn card yang generic. Gunakan `div` dengan manual styling. Ikut design token.

**Context:** Dipakai di `/dashboard` untuk Revenue vs Target, Pipeline Value, Win Rate, Expiring Contracts. Selalu ada: metric utama, label, dan trend/sub-info.

**Layout:**
```
[Card — bg-white, shadow-sm, rounded-lg, p-5]
  [Label — text-sm text-slate-500 font-medium]
  [Value — text-4xl font-bold tabular-nums text-slate-800 mt-1]
  [Trend row — flex items-center gap-1.5 mt-2]
    [Trend icon — arrow-up/down 14px]
    [Trend value — text-sm font-medium]
    [Trend label — text-sm text-slate-400]
```

**States:**

| State | Visual |
|---|---|
| Default | `bg-white shadow-sm border border-slate-200 rounded-lg` |
| Loading | Shimmer placeholder — full card covered. `animate-pulse bg-slate-100 rounded-lg` |
| Positive trend | Trend icon = arrow-up, trend text = `text-green-600`, icon = `text-green-500` |
| Negative trend | Trend icon = arrow-down, trend text = `text-red-600`, icon = `text-red-500` |
| Neutral trend | No icon, trend text = `text-slate-400` |

**Tailwind classes (default state):**
```
card wrapper: bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col gap-1
label: text-sm font-medium text-slate-500
value: text-4xl font-bold tracking-tight text-slate-800 tabular-nums mt-1
trend row: flex items-center gap-1.5 mt-2
trend value positive: text-sm font-medium text-green-600
trend value negative: text-sm font-medium text-red-600
trend label: text-sm text-slate-400
```

**Shimmer loading spec:**
```html
<div class="bg-white rounded-lg border border-slate-200 shadow-sm p-5 animate-pulse">
  <div class="h-4 w-24 bg-slate-200 rounded mb-3"></div>
  <div class="h-9 w-32 bg-slate-200 rounded mb-3"></div>
  <div class="h-4 w-36 bg-slate-200 rounded"></div>
</div>
```

---

### 4.3 Progress Bar / Achievement Gauge

**Base shadcn/ui component:** `Progress` dari shadcn/ui — override color via CSS var.

**Context:** Revenue achievement vs target di `/dashboard` dan `/targets`. Linear horizontal bar.

**Anatomy:**
```
[Label + percentage row — flex justify-between mb-1.5]
  [Left: "Revenue Achievement"] 
  [Right: "Rp 847.000.000 / Rp 1.200.000.000"]
[Progress track — h-2 bg-slate-100 rounded-full]
  [Progress fill — h-full rounded-full transition-all duration-500]
[Sub-label row — flex justify-between mt-1]
  [Left: achievement %] [Right: target label]
```

**Color logic (fill color by percentage):**
| Achievement | Fill Color | Tailwind |
|---|---|---|
| ≥ 100% | `#22C55E` | `bg-green-500` |
| 75%–99% | `#6366F1` | `bg-indigo-500` |
| 50%–74% | `#F59E0B` | `bg-amber-500` |
| < 50% | `#EF4444` | `bg-red-500` |

**Track:** `bg-slate-100 rounded-full h-2`
**Fill transition:** `transition-all duration-500 ease-out`

**States:**
- Default: As above
- Loading: Shimmer on the entire track — `animate-pulse bg-slate-200 rounded-full h-2`
- Over-target (> 100%): Fill cap at 100% width, color stays green, append "Achieved" badge next to percentage

---

### 4.4 Date Alert Chip (Contract Expiry)

**Purpose:** Surface kontrak yang akan expire di `/dashboard` (expiring contracts widget) dan `/clients/[id]` (contract detail section).

**Structure:**
```
[left border 3px colored] [icon] [text content]
  [Client name — text-sm font-medium]
  [Expiry date — text-xs text-muted]
  [Days remaining — text-xs font-semibold colored]
```

**Padding:** `py-3 px-4`
**Background:** Matches urgency background token
**Border-left:** 3px solid, urgency color

| Urgency | Left border | Background | Days text |
|---|---|---|---|
| Critical (≤30d) | `border-l-[3px] border-red-500` | `bg-red-50` | `text-red-700 font-semibold` |
| Warning (31–60d) | `border-l-[3px] border-amber-500` | `bg-amber-50` | `text-amber-700 font-semibold` |
| Notice (61–90d) | `border-l-[3px] border-blue-500` | `bg-blue-50` | `text-blue-700 font-semibold` |

**Tailwind (Critical example):**
```
wrapper: flex items-start gap-3 rounded-lg bg-red-50 border-l-[3px] border-red-500 py-3 px-4
icon: h-4 w-4 text-red-500 flex-shrink-0 mt-0.5
client name: text-sm font-medium text-slate-800
expiry date: text-xs text-slate-500 mt-0.5
days remaining: text-xs font-semibold text-red-700 mt-0.5
```

**States:**
- Default: Static display
- Hover (jika dalam list yang clickable): `hover:bg-red-100 cursor-pointer transition-colors duration-150`
- Loading: Shimmer row `animate-pulse`

---

### 4.5 Data Table

**Base shadcn/ui component:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` dari shadcn/ui.

**Context:** `/clients` (client list), `/pipeline` (leads list view toggle dari Kanban).

**Features required:**
- Sortable columns (click header → sort indicator)
- Sticky header saat scroll
- Row hover state
- Selectable rows (checkbox)
- Filter chips above table

**Table layout:**

```
[Filter bar — flex gap-2 mb-4]
  [Search input]
  [Filter: Health dropdown]
  [Filter: Industry dropdown]
  [Filter: AE dropdown]
  [Right: row count text]

[Table — w-full]
  [thead — sticky top-0 bg-white z-10 border-b border-slate-200]
    [th — text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-3 px-4]
    [th dengan sort — flex items-center gap-1 cursor-pointer hover:text-slate-800]
      [chevron up/down 12px — visible saat active sort]
  [tbody]
    [tr — border-b border-slate-100 transition-colors duration-100]
    [td — text-sm text-slate-700 py-3 px-4]
```

**Row states:**

| State | Background | Text |
|---|---|---|
| Default | `bg-white` | `text-slate-700` |
| Hover | `bg-slate-50` | `text-slate-800` |
| Selected | `bg-indigo-50` | `text-slate-800` |
| Alternating (opsional) | odd: `bg-white` even: `bg-slate-50/50` | — |

**Sort indicator:**
- Unsorted: `text-slate-300` chevron (both up/down stacked, 10px)
- Sort asc: `text-indigo-500` chevron-up (10px)
- Sort desc: `text-indigo-500` chevron-down (10px)

**Empty state (no rows):**
```
[tbody — single row, full colspan]
  [td — py-16 text-center]
    [icon — 40px, text-slate-300]
    [text — text-sm text-slate-400 mt-2] "No clients found."
    [subtext — text-xs text-slate-400 mt-1] "Try adjusting your filters."
```

**Loading state:** 8 shimmer rows.
```
<tr class="animate-pulse border-b border-slate-100">
  <td class="py-3 px-4"><div class="h-4 bg-slate-200 rounded w-3/4"></div></td>
  ...
</tr>
```

**Pagination:** Use shadcn `Pagination` — bottom of table, right-aligned.
- Shows: "Showing 1–20 of 47 clients"
- Page size selector: `[10] [20] [50]` via `Select` component

---

### 4.6 Kanban Board

**Base:** Custom implementation. No shadcn native Kanban — Webo implement dengan `@dnd-kit/core` (drag and drop library, ringan dan accessible).

**Context:** `/pipeline` — stages: Prospecting → Pitched → Negotiating → Contract Renewal → Won / Lost

**Layout:**
```
[Board container — flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-180px)]]
  [Column — flex flex-col w-72 flex-shrink-0]
    [Column header — flex justify-between items-center mb-3]
      [Stage badge] [Card count — text-xs text-slate-400]
    [Add button — w-full, dashed border, text-sm text-slate-400]
    [Card list — flex flex-col gap-2 min-h-[60px]]
      [Kanban Card]
```

**Column header:**
```
wrapper: flex items-center justify-between mb-3 px-1
stage badge: sesuai Stage badge spec (Section 4.1)
count: text-xs font-medium text-slate-400 tabular-nums
```

**Kanban Card:**
```
wrapper: bg-white rounded-lg border border-slate-200 shadow-sm p-4 cursor-grab active:cursor-grabbing
  [Client name — text-sm font-medium text-slate-800]
  [Deal name — text-xs text-slate-500 mt-0.5]
  [Row: value + quarter]
    [value — text-sm font-semibold text-slate-700 tabular-nums]
    [quarter badge — text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded]
  [Row: AE avatar + billing type + date]
    [AE: Avatar 20px rounded-full + name text-xs text-slate-400]
    [billing type chip — text-[10px] rounded px-1.5 py-0.5]
      One-time: bg-slate-100 text-slate-500
      Retainer: bg-indigo-50 text-indigo-600
```

**Kanban Card States:**

| State | Visual |
|---|---|
| Default | `bg-white border-slate-200 shadow-sm` |
| Hover | `bg-slate-50 border-slate-300 shadow-md transition-all duration-150` |
| Dragging | `shadow-lg border-indigo-300 opacity-90 rotate-1 scale-[1.02]` |
| Drop target column | Column background `bg-indigo-50/50` with dashed border `border-2 border-dashed border-indigo-200` |
| Document missing (required before stage advance) | Red dot top-right corner `absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full` |

**Add button (bottom of column):**
```
w-full border-2 border-dashed border-slate-200 rounded-lg py-2.5 text-sm text-slate-400
hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all duration-150
flex items-center justify-center gap-1.5
```

**Won / Lost columns:**
- Won: Column background ringan `bg-green-50/30`
- Lost: Column background ringan `bg-red-50/30`
- Cards di kolom ini non-draggable (atau drag ke dalam saja) — tergantung product decision

**Motion direction:**
- Card drag: spring physics via `@dnd-kit` built-in
- Column drop: easing `ease-out duration-200` pada reorder animasi
- Card enter column: `animate-in fade-in slide-in-from-top-2 duration-200`

---

### 4.7 Document Upload Zone

**Base shadcn/ui component:** Tidak ada native — custom component. Referensi: react-dropzone atau native HTML file input yang di-style.

**Context:** Di `/pipeline/[id]` — dua gate dokumen yang berbeda:
- **Gate 1 — advance ke Pitched:** wajib upload **quotation** (unsigned, initial send ke klien)
- **Gate 2 — advance ke Won:** wajib upload **signed quotation** (dokumen yang sudah ditandatangani klien sebagai final approval)

Dua upload zone yang ditampilkan secara kondisional sesuai stage saat ini. Advance button disabled sampai dokumen yang relevan diupload.

**States:**

**Default (empty, no file):**
```
wrapper: border-2 border-dashed border-slate-300 rounded-lg py-8 px-6 text-center
  bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all duration-200 cursor-pointer
icon: h-10 w-10 text-slate-300 mx-auto mb-3
headline: text-sm font-medium text-slate-700 "Drop document here"
sub: text-xs text-slate-400 mt-1 "or click to browse · PDF, DOCX, XLSX · max 10MB"
```

**Drag over (file hovering above zone):**
```
border-indigo-400 border-2 bg-indigo-50 scale-[1.01] transition-transform duration-150
icon: text-indigo-400
headline: text-indigo-700 "Release to upload"
```

**Uploading:**
```
border-slate-200 bg-slate-50 pointer-events-none
[progress bar: indigo fill, animated, h-1.5 at bottom of zone]
sub text: "Uploading... 67%"
```

**Uploaded / File present:**
```
border-slate-200 bg-slate-50 rounded-lg py-4 px-5
[flex items-center gap-3]
  [file icon — 36px bg-indigo-100 text-indigo-600 rounded-lg p-2]
  [file info]
    [filename — text-sm font-medium text-slate-800]
    [filesize + date — text-xs text-slate-400]
  [actions — ml-auto flex gap-2]
    [view button — text-xs text-indigo-600 hover:underline]
    [delete button — text-xs text-red-500 hover:underline]
```

**Error (upload failed / wrong format):**
```
border-red-300 bg-red-50 rounded-lg py-4 px-5
error icon: text-red-500
error text: text-sm text-red-700 "Upload failed. File must be PDF or DOCX under 10MB."
retry link: text-xs text-indigo-600 underline "Try again"
```

**Gate enforcement UI:**

Dua gate berbeda, masing-masing dengan label kontekstual:

**Gate 1 — advance ke Pitched (quotation belum diupload):**
```
[Section label above upload zone]: text-sm font-medium text-slate-700
  "Quotation Document" + badge: text-xs bg-amber-100 text-amber-700 "Required to advance"
[Stage advance button — disabled]:
  opacity-50 cursor-not-allowed
  tooltip: "Upload quotation document first"
```

**Gate 2 — advance ke Won (signed quotation belum diupload):**
```
[Section label above upload zone]: text-sm font-medium text-slate-700
  "Signed Quotation" + badge: text-xs bg-amber-100 text-amber-700 "Required to mark as Won"
[Stage advance button — disabled]:
  opacity-50 cursor-not-allowed
  tooltip: "Upload signed quotation to confirm deal"
```

**Toast jika user mencoba advance saat gate belum terpenuhi:**
```
[Toast — shadcn useToast, variant destructive]
  Gate 1: "Upload quotation document before advancing to Pitched."
  Gate 2: "Upload signed quotation to confirm this deal as Won."
```

**Uploaded state — show document type label:**
```
[file info row] → tambahkan badge di kiri filename:
  Quotation: bg-slate-100 text-slate-600 text-xs "Quotation"
  Signed:    bg-green-100 text-green-700 text-xs "Signed"
```

---

### 4.8 Form Inputs

**Base shadcn/ui component:** `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Label` — semua dari shadcn/ui. Override di `globals.css` via CSS variables.

**Base input spec:**
```
height: h-9 (36px)
padding: py-2 px-3
font: text-sm font-normal
border: border border-slate-200 rounded-md
background: bg-white
transition: transition-colors duration-150
```

**Input states:**

| State | Border | Background | Text | Shadow/Ring |
|---|---|---|---|---|
| Default | `border-slate-200` | `bg-white` | `text-slate-800` | none |
| Hover | `border-slate-300` | `bg-white` | `text-slate-800` | none |
| Focus | `border-indigo-500` | `bg-white` | `text-slate-800` | `ring-2 ring-indigo-500/20` |
| Filled (valid) | `border-slate-200` | `bg-white` | `text-slate-800` | none |
| Disabled | `border-slate-100` | `bg-slate-50` | `text-slate-400` | none, `cursor-not-allowed` |
| Error | `border-red-400` | `bg-white` | `text-slate-800` | `ring-2 ring-red-500/20` |
| Read-only | `border-slate-100` | `bg-slate-50/50` | `text-slate-600` | none |

**Error message (below input):**
```
text-xs text-red-600 mt-1 flex items-center gap-1
[icon: AlertCircle 12px text-red-500]
"Field is required"
```

**Label:**
```
text-sm font-medium text-slate-700 mb-1.5
[required indicator: text-red-500 ml-0.5 "*"]
```

**Helper text (below input, non-error):**
```
text-xs text-slate-400 mt-1
```

**Select:**
- shadcn `Select` component
- Same visual spec as Input (default, hover, focus, disabled, error)
- Chevron icon: `text-slate-400`, rotates 180deg on open via CSS transform

**Textarea:**
- Same border/background/states as Input
- `min-h-[80px]` default, `resize-y`

**Checkbox:**
- Unchecked: `border-2 border-slate-300 bg-white h-4 w-4 rounded`
- Checked: `bg-indigo-600 border-indigo-600` — white checkmark
- Focus ring: `ring-2 ring-indigo-500/20`
- Disabled: `opacity-50 cursor-not-allowed`

---

### 4.9 Modal / Sheet

**Base shadcn/ui component:**
- Quick edit / add lead / add contact: `Sheet` (slide-in dari kanan)
- Confirmation dialogs / destructive actions: `AlertDialog`
- Complex form (banyak field): `Dialog` fullpage centered

**Sheet spec (primary pattern):**
```
width: 480px (w-[480px]) — desktop
position: right edge slide-in
header: border-b border-slate-200 py-4 px-6
  [title: text-lg font-semibold text-slate-800]
  [subtitle: text-sm text-slate-500 mt-0.5]
  [X button: top-right, h-8 w-8 rounded-md hover:bg-slate-100]
content: py-5 px-6 space-y-4 overflow-y-auto
footer: border-t border-slate-200 py-4 px-6 flex justify-end gap-3
  [Cancel: Button variant="outline"]
  [Save: Button variant="default" (indigo)]
```

**Sheet animation:**
- Open: slide-in-from-right `duration-300 ease-out`
- Close: slide-out-to-right `duration-200 ease-in`
- Backdrop: `bg-black/40 animate-in fade-in duration-200`

**Dialog spec:**
```
max-width: 560px (sm:max-w-[560px])
padding: p-6
border-radius: rounded-xl
shadow: shadow-xl
header: mb-5
  [title: text-lg font-semibold text-slate-800]
  [description: text-sm text-slate-500 mt-1]
footer: mt-6 flex justify-end gap-3
```

**AlertDialog (destructive confirmation):**
```
max-width: 420px
[icon: AlertTriangle — h-10 w-10 text-red-500 mx-auto mb-4]
[title: text-lg font-semibold text-slate-900 text-center]
[description: text-sm text-slate-500 text-center mt-2]
[footer: mt-6 flex gap-3]
  [Cancel: flex-1, variant="outline"]
  [Confirm: flex-1, variant="destructive" — bg-red-600 hover:bg-red-700]
```

**Modal states:**

| State | Visual |
|---|---|
| Loading (submit in progress) | Submit button: `opacity-75 pointer-events-none` + spinner icon `animate-spin` gantikan checkmark |
| Success | Sheet/Dialog close, toast success muncul |
| Error (server) | Error banner di dalam modal: `bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4` |

---

### 4.10 Navigation — Sidebar

**Pattern:** Fixed left sidebar. Ini internal tool yang task-dense — sidebar selalu visible, bukan collapsible-by-default. Desktop-first.

**Spec:**
```
width: 240px (w-60)
background: bg-slate-50
border-right: border-r border-slate-200
height: h-screen sticky top-0
padding: py-4
```

**Top section (logo / brand):**
```
px-4 py-3 mb-2 border-b border-slate-200
[logo: vosFoyer wordmark atau "VF" monogram — 28px]
[app name: "ERP" — text-xs font-semibold text-slate-400 uppercase tracking-wider ml-2]
```

**Nav group label:**
```
text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-4 mb-1 mt-4
```

**Nav item:**
```
flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium mx-2
transition-colors duration-100
```

**Nav item states:**

| State | Background | Text | Icon |
|---|---|---|---|
| Default | transparent | `text-slate-600` | `text-slate-400` |
| Hover | `bg-slate-100` | `text-slate-800` | `text-slate-600` |
| Active (current page) | `bg-indigo-50` | `text-indigo-700` | `text-indigo-600` |
| Active indicator | left border 2px `border-l-2 border-indigo-600` — di sisi kiri `mx-2` wrapper | — | — |

**Active item detail:**
```
bg-indigo-50 text-indigo-700 font-semibold
[left accent: -mx-2 pl-[calc(0.75rem - 2px)] border-l-2 border-indigo-600]
```

**Icon size:** 16px (`h-4 w-4`)

**Navigation items:**
```
COMMERCIAL
- /dashboard      — LayoutDashboard icon — "Dashboard"
- /pipeline       — KanbanSquare icon — "Pipeline"
- /clients        — Users icon — "Clients"

PERFORMANCE
- /targets        — Target icon — "Targets"
- /analytics      — BarChart3 icon — "Analytics"

ADMIN
- /settings       — Settings icon — "Settings"
```

**Bottom section (user info):**
```
mt-auto pt-4 border-t border-slate-200 px-4 py-3
[flex items-center gap-3]
  [Avatar: 32px rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold — initials]
  [User info]
    [name: text-sm font-medium text-slate-700]
    [role: text-xs text-slate-400]
  [Settings icon: ml-auto h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600]
```

---

## 5. Page Layout Specs

### 5.1 Overall Shell

```
[Root layout — flex h-screen overflow-hidden bg-white]
  [Sidebar — w-60 flex-shrink-0 — see Section 4.10]
  [Main area — flex flex-col flex-1 min-w-0 overflow-hidden]
    [Topbar — h-14 border-b border-slate-200 bg-white flex items-center px-8 — sticky]
      [Page breadcrumb + title]
      [Actions — ml-auto flex gap-3]
    [Page content — flex-1 overflow-y-auto px-8 py-6]
```

**Topbar content per page:**

| Page | Left (title) | Right (actions) |
|---|---|---|
| /dashboard | "Dashboard" H1 + date | Period selector (This Month / This Quarter) |
| /clients | "Clients" H1 + count chip | Search (inline), `+ Add Client` button |
| /clients/[id] | Breadcrumb: Clients → [Client Name] | `Edit` button, `...` more menu |
| /pipeline | "Pipeline" H1 | View toggle (Kanban / List), `+ Add Lead` button |
| /pipeline/[id] | Breadcrumb: Pipeline → [Lead Name] | Stage advance button (primary), `...` more |
| /targets | "Targets" H1 + current period | Period selector, `Edit Targets` button |
| /analytics | "Analytics" H1 | Date range picker, `Export` button |
| /settings | "Settings" H1 | — |

### 5.2 /dashboard

**Grid layout:**
```
[KPI strip — grid grid-cols-4 gap-4 mb-8]
  [KPI Card: Revenue MTD]
  [KPI Card: Pipeline Value]
  [KPI Card: Win Rate]
  [KPI Card: Expiring Contracts — count]

[Two-column — grid grid-cols-3 gap-6]
  [Left: 2/3 — grid col-span-2]
    [Section: Revenue vs Target — progress bar card, full width]
    [Section: Recent Pipeline Activity — list of last 5 moved leads]
  [Right: 1/3 — grid col-span-1]
    [Section: Expiring Contracts — list of date alert chips, scrollable up to 5]
    [Section: Client Health Summary — 3 stat pills: Healthy / At-Risk / Churned count]
```

**Breakpoint behavior:**
- Desktop (≥ 1280px): 4-col KPI, 3-col body
- Laptop (1024–1279px): 4-col KPI, 2-col body (2+1 → 1+1)
- Tablet (768–1023px): 2-col KPI, 1-col body (stacked)
- Mobile: tidak dioptimalkan untuk MVP

### 5.3 /clients

```
[Filter bar — flex items-center gap-3 mb-5]
  [Search input — w-72]
  [Health filter — Select, w-36]
  [Industry filter — Select, w-40]
  [AE filter — Select, w-36]
  [ml-auto: row count text-sm text-slate-500]

[Data table — w-full]
Columns: Client Name · Industry · Health · AE · Contract Value · Contract End · Actions
```

**Column widths (approximate):**
- Client Name: `min-w-[200px] flex-1`
- Industry: `w-36`
- Health: `w-28` — badge
- AE: `w-36`
- Contract Value: `w-32 text-right tabular-nums`
- Contract End: `w-32`
- Actions: `w-20 text-right`

**Actions per row:** `...` icon button (more menu) → dropdown: View Profile, Edit, Add Contact, Mark At-Risk

### 5.4 /clients/[id]

**3-panel layout:**
```
[Back link — mb-6]
[Header — flex items-start justify-between mb-8]
  [Left: Client name H1 + industry chip + health badge]
  [Right: Edit button, more menu]

[Grid — grid grid-cols-3 gap-6]
  [Left panel — col-span-2]
    [Card: Contract Details]
      [Value, start date, end date, billing type]
      [Document: contract upload zone — compact variant]
    [Card: Contacts]
      [List of contacts: name, role, email, phone]
      [+ Add Contact button]
    [Card: Notes / Activity Log]
      [Chronological list of notes + actions]
      [Note input: Textarea + submit]
  [Right panel — col-span-1]
    [Card: AE Assigned]
    [Card: Upsell Opportunities]
      [List of open upsell items with status chips]
    [Card: Pipeline History]
      [Past deals / stages — compact list]
```

### 5.5 /pipeline

**Default view:** Kanban board

**Layout:**
```
[View toggle — right of topbar: Kanban / List]

[Kanban — flex gap-4 overflow-x-auto pb-6 -mx-8 px-8]
  5 columns: Prospecting · Pitched · Negotiating · Contract Renewal · Won/Lost (merged or split)
  Each column: w-72 flex-shrink-0
```

**List view toggle:** Ketika user switch ke list view, tampilkan Data Table (spec Section 4.5) dengan columns: Lead Name · Client · Stage · Value · AE · Quarter · Last Updated.

### 5.6 /pipeline/[id]

**Layout:**
```
[Header — flex justify-between mb-8]
  [Left: Lead name H1 + Stage badge]
  [Right: Advance Stage button — indigo, disabled jika doc missing]

[Grid — grid grid-cols-3 gap-6]
  [Left — col-span-2]
    [Card: Lead Details — form fields: client, project type, value, billing plan, quarter]
    [Card: Documents — two upload zones, shown conditionally by stage]
      [Zone 1: "Quotation" — always visible once stage ≥ Prospecting]
      [Zone 2: "Signed Quotation" — visible once stage = Negotiating or Contract Renewal]
    [Card: Notes — chronological, with add note]
  [Right — col-span-1]
    [Card: Stage History — timeline component]
    [Card: AE + Team]
    [Card: Quotation Summary — extracted from doc or manually entered]
```

**Stage advance button logic:**
- Stage = Prospecting, no quotation uploaded → button disabled: "Upload quotation to advance"
- Stage = Prospecting, quotation uploaded → button enabled: "Advance to Pitched"
- Stage = Pitched / Negotiating / Contract Renewal, no signed quotation → button enabled for intermediate advances, BUT "Mark as Won" blocked until signed quotation uploaded
- Stage = Negotiating or Contract Renewal, signed quotation uploaded → "Mark as Won" enabled
- Already Won or Lost → no advance button; show "Reopen" action (admin only)

### 5.7 /targets

```
[Period selector — tab group: Monthly / Quarterly]

[Grid — grid grid-cols-2 gap-6]
  [Left]
    [Card: Set Targets — form per month/quarter per AE]
    [Table: Target history]
  [Right]
    [Card: Current Period Achievement]
      [Progress bars per AE]
    [Card: Team Total Progress]
```

### 5.8 /analytics

```
[Date range picker — topbar right]

[Grid — grid grid-cols-2 gap-6 mb-6]
  [Card: Win Rate — % + trend line chart]
  [Card: Revenue Trend — bar chart by month]

[Grid — grid grid-cols-3 gap-6]
  [Card: Pipeline Funnel — horizontal funnel or stage-by-stage bar]
  [Card: Client Retention — % retained YoY]
  [Card: AE Performance — table: AE name, pipeline value, won, win rate]
```

**Chart library recommendation for Webo:** `recharts` — lightweight, React-native, excellent composability. Atau `@tremor/react` jika ingin opinionated charting components out of the box.

**Chart color sequence (untuk multi-series):**
1. `#6366F1` — Indigo (primary)
2. `#22C55E` — Green
3. `#F59E0B` — Amber
4. `#3B82F6` — Blue
5. `#94A3B8` — Slate (background / baseline)

### 5.9 /settings

**Scope for Phase 1 MVP — intentionally minimal. Full spec deferred to Phase 2.**

```
[Header: "Settings" H1]

[Grid — grid grid-cols-1 gap-6 max-w-2xl]

  [Card: Team Members]
    [Table: name · email · role · status · actions]
    [Add User button — top right of card]
    Note: User creation & role assignment — admin only

  [Card: Pipeline Settings]
    [Stage labels — read-only in MVP, editable in Phase 2]
    [Default AE assignment — dropdown]
```

**Role behavior on this page:**
- `admin` — full access: can add/edit users, change roles
- All other roles — no access to `/settings` (redirect to `/dashboard`)

---

### 5.10 Responsive Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| `sm` | 640px | — |
| `md` | 768px | Sidebar collapsible on tablet |
| `lg` | 1024px | Primary target — semua layout harus perfect di sini |
| `xl` | 1280px | Full layout dengan sidebar + 3-col content |
| `2xl` | 1536px | Max content width cap: `max-w-[1400px] mx-auto` |

**Mobile (< 768px):** Not optimized for MVP. Show "best viewed on desktop" banner pada viewport < 768px. Sidebar hidden, topbar only.

---

## 6. shadcn/ui Theme Customization

### 6.1 `globals.css` — Full Override

Paste ini ke `app/globals.css`. Mengganti semua default shadcn CSS variables ke VF ERP color system.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* === BACKGROUNDS === */
    --background: 0 0% 100%;           /* #FFFFFF — page bg */
    --foreground: 215 28% 17%;         /* #1E293B — primary text */

    /* === CARD === */
    --card: 0 0% 100%;                 /* #FFFFFF */
    --card-foreground: 215 28% 17%;

    /* === POPOVER === */
    --popover: 0 0% 100%;
    --popover-foreground: 215 28% 17%;

    /* === PRIMARY (Indigo) === */
    --primary: 239 84% 67%;            /* #6366F1 */
    --primary-foreground: 0 0% 100%;

    /* === SECONDARY === */
    --secondary: 210 40% 96%;          /* #F1F5F9 — slate-100 */
    --secondary-foreground: 215 28% 17%;

    /* === MUTED === */
    --muted: 210 40% 96%;              /* #F1F5F9 */
    --muted-foreground: 215 16% 47%;   /* #64748B — slate-500 */

    /* === ACCENT === */
    --accent: 238 75% 95%;             /* #EEF2FF — indigo-50 */
    --accent-foreground: 238 83% 50%;  /* #4338CA — indigo-700 */

    /* === DESTRUCTIVE === */
    --destructive: 0 84% 60%;          /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    /* === BORDER === */
    --border: 214 32% 91%;             /* #E2E8F0 — slate-200 */
    --input: 214 32% 91%;
    --ring: 239 84% 67%;               /* #6366F1 — focus ring */

    /* === RADIUS === */
    --radius: 0.5rem;                  /* 8px — base radius */

    /* === CUSTOM SEMANTIC TOKENS === */
    --color-success-50: #F0FDF4;
    --color-success-500: #22C55E;
    --color-success-700: #15803D;
    --color-warning-50: #FFFBEB;
    --color-warning-500: #F59E0B;
    --color-warning-700: #B45309;
    --color-danger-50: #FFF1F2;
    --color-danger-500: #EF4444;
    --color-danger-700: #B91C1C;
    --color-info-50: #EFF6FF;
    --color-info-500: #3B82F6;
    --color-info-700: #1D4ED8;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Tabular nums global — untuk semua angka di ERP */
  .tabular-nums {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }
}
```

### 6.2 `tailwind.config.ts` — Full Config

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* Semantic status colors — accessible via bg-success-500, text-danger-700, etc. */
        success: {
          50: "#F0FDF4",
          500: "#22C55E",
          700: "#15803D",
        },
        warning: {
          50: "#FFFBEB",
          500: "#F59E0B",
          700: "#B45309",
        },
        danger: {
          50: "#FFF1F2",
          500: "#EF4444",
          700: "#B91C1C",
        },
        info: {
          50: "#EFF6FF",
          500: "#3B82F6",
          700: "#1D4ED8",
        },
      },
      borderRadius: {
        lg: "var(--radius)",         /* 8px */
        md: "calc(var(--radius) - 2px)", /* 6px */
        sm: "calc(var(--radius) - 4px)", /* 4px */
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        modal: "0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)",
        dropdown: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        "kanban": "0 1px 3px 0 rgb(0 0 0 / 0.08)",
        "kanban-drag": "0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

### 6.3 `components.json` — shadcn/ui Config

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

**Note untuk Webo:** Saat install shadcn/ui, gunakan `--base-color slate` agar semua generated component defaults sesuai dengan spec ini. Setelah `npx shadcn@latest init`, replace `globals.css` dengan versi di Section 6.1 di atas.

---

## 7. Motion Direction

Internal tool — motion harus functional, bukan dekoratif. Semua animasi di bawah adalah direction spec untuk Webo.

### 7.1 Library: Framer Motion

Gunakan Framer Motion untuk UI-layer animations. Ini React/Next.js app, bukan marketing site — Framer Motion adalah pilihan tepat.

### 7.2 Animation Principles

- **Duration cap:** Tidak ada UI animation yang melebihi 300ms. Fast = professional.
- **Easing standard:** `ease-out` untuk element masuk ke screen. `ease-in` untuk element keluar. `spring` untuk drag + physics-based.
- **No bounce:** Tidak ada spring dengan bounciness tinggi. Internal tool bukan playful app.
- **Reduced motion:** Semua animasi harus dibungkus `@media (prefers-reduced-motion: reduce)` — disable animasi untuk accessibility.

### 7.3 Animation Specs

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Page transition | Route change | `opacity: 0→1, y: 8→0` | 200ms | `ease-out` |
| Sheet open | Open trigger | `x: 100%→0` | 300ms | `ease-out` |
| Sheet close | Close trigger | `x: 0→100%` | 200ms | `ease-in` |
| Modal open | Open trigger | `opacity: 0→1, scale: 0.96→1` | 200ms | `ease-out` |
| Backdrop appear | Modal/sheet open | `opacity: 0→1` | 200ms | `ease-out` |
| Kanban card drag | onDragStart | `scale: 1→1.02, rotate: 0→1deg, shadow: sm→lg` | 150ms | `ease-out` |
| Kanban card drop | onDragEnd | `scale: 1.02→1, rotate: 1→0deg` | 200ms | spring (stiffness: 300, damping: 20) |
| KPI card enter | Page load | `opacity: 0→1, y: 12→0` stagger 50ms per card | 250ms | `ease-out` |
| Toast notification | Trigger | `opacity: 0→1, y: 16→0` | 200ms | `ease-out` |
| Row hover | hover | `background-color transition` | 100ms | `ease-out` via CSS |
| Progress bar fill | Mount | `width: 0→{value}%` | 500ms | `ease-out` delay 200ms |
| Dropdown menu | Open | `opacity: 0→1, y: -4→0` | 150ms | `ease-out` |
| Accordion/collapsible | Toggle | Radix built-in `accordion-down/up` | 200ms | `ease-out` |

### 7.4 Shimmer Loading Pattern

CSS-based shimmer — lebih performant dari JS-based. Apply via `animate-shimmer` class.

```css
/* globals.css — shimmer utility */
@layer utilities {
  .shimmer {
    background: linear-gradient(
      90deg,
      #f1f5f9 25%,
      #e2e8f0 50%,
      #f1f5f9 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}
```

---

## 8. shadcn/ui Component Installation List

Webo harus install komponen berikut setelah `shadcn init`:

```bash
npx shadcn@latest add badge
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add textarea
npx shadcn@latest add checkbox
npx shadcn@latest add radio-group
npx shadcn@latest add switch
npx shadcn@latest add dialog
npx shadcn@latest add alert-dialog
npx shadcn@latest add sheet
npx shadcn@latest add table
npx shadcn@latest add dropdown-menu
npx shadcn@latest add navigation-menu
npx shadcn@latest add toast
npx shadcn@latest add progress
npx shadcn@latest add separator
npx shadcn@latest add avatar
npx shadcn@latest add tabs
npx shadcn@latest add tooltip
npx shadcn@latest add popover
npx shadcn@latest add calendar
# DatePicker: bukan standalone component — implement sebagai komposisi Calendar + Popover + Button
# Lihat: ui.shadcn.com/docs/components/date-picker
npx shadcn@latest add breadcrumb
npx shadcn@latest add pagination
npx shadcn@latest add skeleton
npx shadcn@latest add command
```

**Additional packages (bukan shadcn — install via npm):**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities   # Kanban drag-drop
npm install framer-motion                                          # UI animations
npm install recharts                                               # Charts di /analytics
npm install react-dropzone                                         # Document upload zone
npm install date-fns                                               # Date formatting
```

---

## 9. Design Decisions Log — Rationale

Setiap keputusan non-obvious dicatat di sini agar Webo tidak perlu interpret.

**1. Mengapa Slate, bukan pure Gray atau Zinc?**
Slate memiliki subtle blue undertone yang terasa lebih sophisticated dan digital-native dibanding pure gray (terlalu clinical) atau warm gray (terlalu casual untuk financial/CRM tool). Cocok untuk agency yang positioning-nya adalah "professional partner."

**2. Mengapa Indigo sebagai accent, bukan Blue?**
Pure blue terlalu generic (terasa seperti generic SaaS). Indigo membawa nuansa depth + authority + trust tanpa aggressive. Sesuai dengan postur vosFoyer sebagai consultative partner, bukan commodity vendor.

**3. Mengapa tidak dark mode untuk MVP?**
Tim commercial vosFoyer bekerja di daytime office environment, dengan screen sharing ke klien atau internal meeting sering terjadi. Light mode adalah default yang aman dan menghilangkan satu layer complexity dari MVP. Dark mode bisa di-add di v2 jika ada user demand. Dark mode tidak wajib di brief.

**4. Mengapa Sidebar fixed, bukan top navigation?**
Tool ini adalah task-dense internal app — user berpindah antar section (Pipeline, Clients, Analytics) dengan frekuensi tinggi. Top navigation dengan horizontal items lebih baik untuk consumer app dengan ≤ 5 sections. Sidebar persistent memungkinkan context switching yang cepat tanpa kehilangan scroll position.

**5. Mengapa Sheet (slide-in) bukan full Dialog untuk add/edit?**
Sheet memungkinkan user melihat background context (misalnya: Kanban board saat menambah lead, atau client list saat edit client) tanpa interrupt. Dialog adalah pilihan hanya untuk destructive actions (confirmation) yang memang perlu full focus.

**6. Mengapa Document Upload adalah hard gate (disable stage advance)?**
Ini bukan UX purist decision — ini business process enforcement. Pipeline stage yang advance tanpa dokumen adalah sumber chaos audit internal. Hard gate via disabled button + tooltip adalah cara paling direct untuk enforce tanpa confusing error message.

**7. Mengapa @dnd-kit bukan react-beautiful-dnd untuk Kanban?**
react-beautiful-dnd sudah tidak actively maintained (Atlassian deprecate). @dnd-kit adalah successor yang modern, accessible by default, TypeScript-first, dan lebih performant dengan virtual lists jika pipeline board membesar.

**8. Mengapa Progress bar fill color berubah berdasarkan persentase achievement?**
Color encoding yang instant-readable: merah = kritis, amber = perlu perhatian, indigo = on track, hijau = achieved. User harus bisa membaca health di /targets tanpa baca angkanya — hanya dari warna. Ini adalah visual density optimization yang penting untuk dashboard.

**9. Typography: mengapa Inter, bukan Plus Jakarta Sans?**
Plus Jakarta Sans adalah pilihan utama Wiux untuk Indonesian Market-Tuned projects. VF ERP adalah internal tool untuk tim commercial — bukan consumer-facing, bukan Indonesian audience targeting. Inter optimal untuk dashboard/data-heavy interface karena tabular number rendering-nya superior dan sudah battle-tested di Vercel, Linear, Notion — referensi estetis yang tepat untuk tool ini. Jika vosFoyer ingin ada brand connection ke Plus Jakarta Sans di future version, bisa di-layer sebagai display font untuk headings only.

---

## 10. Design System Tidak Dalam Scope Spec Ini

Berikut hal-hal yang perlu di-decide bersama William/Oci sebelum Webo mulai — bukan Wiux yang bisa putuskan secara unilateral:

Semua item di bawah sudah dikonfirmasi. Tidak ada blocker sebelum Webo mulai.

1. **Data model** ✅ — Client → Contact = one-to-many (satu klien bisa punya banyak PIC: marketing, finance, Director). `/clients/[id]` menampilkan semua contacts + associated leads.
2. **User roles & permission** ✅ — VP Commercial bisa lihat semua pipeline (tidak dibatasi per AE). Admin bisa edit targets. `/settings` hanya accessible oleh `admin` role.
3. **Currency formatting** ✅ — Full format selalu: "Rp 847.000.000". Tidak ada abbreviated format. Berlaku di semua views termasuk KPI cards.
4. **Billing plan types** ✅ — Dua tipe saja: **One-time** dan **Retainer**. Tidak ada Hybrid. Badge variants: One-time = `bg-slate-100 text-slate-500`; Retainer = `bg-indigo-50 text-indigo-600`.
5. **Quarter definition** ✅ — Calendar year: Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Okt–Des.

---

*Spec ini adalah handoff document dari Wiux ke Webo. Semua keputusan visual di atas sudah final dan justified. Jika ada ambiguitas implementasi (bukan design decision), Webo bisa langsung decide — spec ini sudah cukup untuk implement tanpa clarifying question ke Wiux.*

*Boleh output ini masuk ke approved sample library sebagai referensi standar kualitas?*
