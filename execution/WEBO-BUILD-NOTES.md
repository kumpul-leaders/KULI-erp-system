# WEBO Build Notes — Phase 3 Batch 2 (Retention UI + Dark Mode)
**Date:** 2026-07-03
**Branch:** main
**Build result:** PASS (35 pages, 0 errors, 0 tsc errors, 161 tests)

---

## Files Changed

### New components (4)
- `src/components/dashboard/alerts-panel.tsx` — live alerts from GET /api/alerts?status=open, max 8, inline acknowledge, fallback to expiring contracts prop
- `src/components/clients/health-score-popover.tsx` — upgraded health badge: score number + Popover with 4 signal bars, Indonesian labels, computedAt footer, "v1 (proxy)" label; no-snapshot state handled
- `src/components/clients/client-alerts-banner.tsx` — alert banner for client detail: color per type (warning T-60, danger T-30/health_drop), acknowledge + resolve inline
- `src/components/pipeline/create-renewal-button.tsx` — "Buat Renewal Lead" button: fetches latest won lead on first click, pre-fills LeadFormSheet with clientId/productLine/revenue/stage:contract_renewal/renewedFromLeadId

### Modified — pages (2)
- `src/app/(dashboard)/clients/[id]/page.tsx` — adds openAlerts + latestSnapshot to Promise.all; renders ClientAlertsBanner + CreateRenewalButton conditionally; HealthBadge replaced with HealthScorePopover; renewal chain in LinkedProjectRow; dark mode on all sub-sections
- `src/app/(dashboard)/pipeline/[id]/page.tsx` — fetchLead includes renewedFromLead + renewals relations; serializes both; passes to LeadDetailClient

### Modified — components (9)
- `src/components/dashboard/dashboard-content.tsx` — replaces static "contract alerts 90 hari" card with AlertsPanel
- `src/components/pipeline/lead-form-sheet.tsx` — adds exported LeadFormInitialValues interface, optional initialValues prop, SheetTitle adapts to renewal mode; backward compatible
- `src/components/pipeline/lead-detail-client.tsx` — adds optional renewedFromLead + renewals props; shows "Renewal of → {client}" link + renewal badge list
- `src/components/clients/clients-table.tsx` — admin archive toggle: fetchArchived (GET ?archived=1), handleRestore (PATCH {restore:true}), muted row style, toast on restore
- `src/components/pipeline/pipeline-list-view.tsx` — same archive/restore pattern; adds userRole prop; archived leads table at bottom
- `src/components/analytics/analytics-content.tsx` — Recharts axis/grid: all hardcoded hex replaced with CSS var tokens (neutral-200 grid, neutral-400/neutral-600 ticks, neutral-50 tooltip cursor)
- `src/components/clients/contacts-card.tsx` — dark mode: card border/bg, dividers, name/role/email text
- `src/components/clients/upsells-card.tsx` — dark mode: card border/bg, dividers, service name/value/notes text
- `src/components/clients/ae-card.tsx` — dark mode: card border/bg, AE name, empty state text
- `src/components/clients/edit-client-sheet.tsx` — dark mode: customer code badge bg/text/border

---

## Key Decisions

### Dashboard fallback
AlertsPanel fetches /api/alerts?status=open client-side (useEffect justified: live data + inline mutations). When 0 alerts returned, falls back to expiringContracts prop (server-fetched by parent page) — not blank empty state. Rationale: zero-alert is common pre-cron-run; contract expiry data is immediately useful.

### Health badge
New HealthScorePopover wraps existing HealthStatus badge with Popover. HealthBadge component untouched — other callers unaffected. Score only shown when snapshot exists; no-snapshot state shows tooltip "Health score belum dihitung".

### LeadFormSheet renewal mode
initialValues prop is optional (undefined default). INITIAL_FORM constant unchanged. All existing form callers work without modification. SheetTitle switches to "Buat Renewal Lead" only when initialValues.renewedFromLeadId is set.

### Recharts dark mode
CSS variables cascade to SVG because next-themes puts .dark on html element. Recharts accepts CSS var strings in stroke/fill string props directly. No context or wrapper needed.

### Admin gate pattern
isAdmin = ["admin", "commercial_director"].includes(userRole ?? "") — consistent with existing codebase pattern.

---

## Build Verification
- npx tsc --noEmit: 0 errors
- npm run test: 161 passed (8 test files)
- npm run build: PASS, 35 pages compiled, 0 warnings
