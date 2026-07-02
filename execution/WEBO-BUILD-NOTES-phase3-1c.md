# WEBO Build Notes — Phase 3 Batch 1C: Mobile + Dark Mode
Date: 2026-07-03

## Files Changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Added `@custom-variant dark`; dark palette block under `.dark`; dark shimmer utility |
| `src/app/layout.tsx` | Wrapped with `ThemeProvider`; `suppressHydrationWarning` on `<html>`; `bg-background` on body |
| `src/app/(dashboard)/layout.tsx` | Injected `MobileSidebar` + `ThemeToggle` + `NotificationBell` in absolute overlay; removed old bell-only overlay |
| `src/components/shared/theme-provider.tsx` | NEW — thin client wrapper for `next-themes` ThemeProvider |
| `src/components/shared/theme-toggle.tsx` | NEW — Moon/Sun toggle; `variant="icon"` for topbar, `variant="full"` for account page |
| `src/components/layout/sidebar.tsx` | `hidden md:flex` (hidden mobile); all `dark:` classes on bg/border/text/active states |
| `src/components/layout/topbar.tsx` | Dark mode border/bg/text; `pl-14 pr-4 md:px-8` for mobile hamburger clearance; `z-20` |
| `src/components/layout/logout-button.tsx` | Dark mode hover states |
| `src/components/layout/mobile-sidebar.tsx` | NEW — Sheet-based drawer; hamburger trigger; mirrors sidebar nav exactly; closes on link click |
| `src/components/dashboard/dashboard-content.tsx` | KPI grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`; body: `grid-cols-1 lg:grid-cols-3`; Sheet full-screen mobile; `dark:` on all cards/surfaces/tables; `px-4 md:px-8` |
| `src/components/notifications/notification-bell.tsx` | Dark mode on popover, list items, header, footer |
| `src/components/notifications/notifications-view.tsx` | Dark mode on filter toggles, list container, items, dividers |
| `src/components/clients/clients-table.tsx` | Dark mode on table wrapper, empty state; mobile search input full-width on small screens; `WebkitOverflowScrolling: touch` |
| `src/components/settings/settings-content.tsx` | Targeted dark mode on card surfaces, table wrappers, thead, rows (sed batch) |
| `src/app/(dashboard)/account/account-content.tsx` | Dark mode on all cards + labels; added Appearance card with `ThemeToggle` |
| `src/app/(dashboard)/account/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/clients/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/notifications/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/settings/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/clients/[id]/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/activities/page.tsx` | `px-4 md:px-8` |
| `src/app/(dashboard)/pipeline/page.tsx` | `px-4 md:px-8 py-4 md:py-6` |
| `src/components/targets/targets-content.tsx` | `px-4 md:px-8` |
| `src/components/analytics/analytics-content.tsx` | `px-4 md:px-8` |

## Dark Palette Decisions

- Base: `neutral-900` (#0f172a) page background, `neutral-800` (#1e293b) card surface
- Neutral scale: flipped — `neutral-50` maps to `#1e293b`, `neutral-800` maps to `#f1f5f9`
- Accent: indigo-400 (`#818cf8`) as primary instead of indigo-500 — more visible on dark bg
- Status colors: darkened `50` backgrounds (e.g. `success-50: #052e16`); `500/700` brightened to light variants for readability
- `@custom-variant dark (&:where(.dark, .dark *))` — Tailwind v4 CSS-first dark variant
- `next-themes` attribute="class", defaultTheme="system" — respects OS preference on first load

## Areas Not Fully Dark-Mode-Swept (tracked)

- `src/components/clients/add-client-sheet.tsx` / `edit-client-sheet.tsx` — Sheet form internals (inputs, selects) inherit shadcn defaults which are partially dark-aware via CSS vars, but labels and some text colors are hardcoded light
- `src/components/settings/settings-content.tsx` — Partial sweep only (card/table surfaces). Inline text colors (`text-neutral-700`, `text-neutral-800`) on many individual cells NOT updated — would require full rewrite
- `src/components/analytics/analytics-content.tsx` — Recharts axis/grid colors not updated; no `stroke` CSS var wired. Charts will show light axis lines on dark background
- `src/components/targets/targets-content.tsx` — Progress bars use `bg-neutral-100` which maps to dark neutral via token flip, but some inline color classes remain light
- `src/app/(dashboard)/clients/[id]/page.tsx` client detail view — Card components (contacts, upsells, AE cards) NOT dark-swept; agent scope boundary respected
- Pipeline kanban — NOT touched per brief (handled separately)
- Activities view — NOT touched per brief (`src/components/activities/activities-view.tsx`)

## Build Results

- `npx tsc --noEmit` — 0 errors
- `npm run test` — 122/122 tests passed
- `npm run build` — clean, no errors or warnings
