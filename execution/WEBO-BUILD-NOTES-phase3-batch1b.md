# WEBO Build Notes — Phase 3 Batch 1B (Pipeline Views)
Date: 2026-07-03

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/components/shared/month-calendar.tsx` | Generic month grid — accepts `CalendarItem[]` with `{date, render}`. Custom CSS grid (no heavy lib). react-day-picker NOT used (already installed but not needed — custom grid is simpler). Month nav: prev/next/today. Collapsible "Tanpa tanggal" row for undated items. Overflow: shows max 4 items per cell + "+N lainnya" label. |
| `src/components/pipeline/pipeline-calendar-view.tsx` | Pipeline calendar. Maps leads to CalendarItem. `expectedCloseDate` → date key (sliced to YYYY-MM-DD). Chips: client name + revenue, colored per stage using STAGE_CHIP_CLASSES (mirrors pipeline-stage-badge.tsx conventions). Click → `router.push(/pipeline/[id])`. Undated row label: "Leads tanpa close date". |
| `src/components/activities/activities-calendar-view.tsx` | Activities calendar. Chips: status dot (overdue/today/upcoming) + type icon + subject. Click chip → popover with "Tandai Selesai" + "Jadwalkan Ulang" — mirrors existing RescheduleInline pattern. Optimistic remove on mark-done + `router.refresh()`. |

### Modified Files
| File | Change |
|------|--------|
| `src/components/pipeline/pipeline-card.tsx` | Added `expectedCloseDate: string | null` to `SerializedLead` interface (was missing — leads API was already serializing it) |
| `src/components/pipeline/pipeline-kanban-loader.tsx` | - viewMode type extended to `"kanban" | "list" | "calendar"` — Added `CalendarDays` icon import — Added "Calendar" button to view toggle group — Renders `<PipelineCalendarView>` when `viewMode === "calendar"` — Overflow set to `overflow-y-auto` for calendar mode |
| `src/components/pipeline/pipeline-list-view.tsx` | +4 inline edit columns: stage, probability, expectedCloseDate, projectedRevenue. Details below. |
| `src/components/activities/activities-view.tsx` | Added view toggle (list/calendar) to toolbar. Calendar renders `<ActivitiesCalendarView>`. List content gated on `viewMode === "list"` (proper JSX wrapping — avoids ternary precedence bug). |

## Inline Edit Details (pipeline-list-view.tsx)

### New Columns Added
- Stage (`InlineStageCell`) — shadcn Select, no explicit edit trigger (Select opens on click). Gate: POST `/api/leads/[id]/stage` → on 400/409 `toast.error(msg)`, no optimistic update (reverts naturally since override not set). On success: toast + `setStageOverrides`.
- Probability (`InlineProbabilityCell`) — click to edit, number input 0-100, Enter/blur save, Esc cancel. PATCH `/api/leads/[id]` with `{probability}`. Validation: 0-100 range enforced client-side before fetch.
- Close Date (`InlineExpectedCloseDateCell`) — Popover + Calendar picker. "Hapus" button to clear. PATCH sends `{expectedCloseDate: "YYYY-MM-DD"}`. On select: immediate save (no confirm step needed — date picker intent is clear).
- Projected Revenue (`InlineProjectedRevenueCell`) — same pattern as existing `ActualRevenueCell`.

### State Added to PipelineListView
```ts
const [projectedRevenueOverrides, ...]
const [probabilityOverrides, ...]
const [closeDateOverrides, ...]
const [stageOverrides, ...]
```

### Footer Changes
- Probability: empty cell (no calc — percentage aggregate not useful)
- Close Date: empty cell (no calc — date aggregation not useful)
- Projected Revenue footer now uses `effectiveLeads` (respects optimistic overrides, consistent with Actual Revenue)

### Preserved
- Pagination structure (PAGE_SIZE = 25, footer stats from full filtered set) — untouched
- `effectiveLeads` pattern — extended, not replaced
- Filter sync effect (no searchParams dependency) — untouched
- All existing sort columns + sort logic preserved

## Key Decisions
1. `expectedCloseDate` in `SerializedLead` — was already being serialized by `GET /api/leads` (`.toISOString() ?? null`) but missing from the TypeScript interface. Added to `pipeline-card.tsx` interface only.
2. Stage inline edit: uses Select (always visible, no "click to show" affordance) — hover reveals chevron via Tailwind group-hover. This is intentional: stage is the most important field to change, making it always-accessible via Select is better UX than requiring a click to reveal.
3. Calendar grid: built custom (7-col CSS grid, gap-px, border-collapse via `bg-neutral-200` gap). Chose this over react-day-picker because the library's cell rendering API is restrictive for custom content.
4. `?view=calendar` param: NOT implemented — view state is local (useState in loader), consistent with how kanban/list toggle already works. URL-persisted view would require URL param coordination that was out of scope.

## Verification
- `npx tsc --noEmit`: 0 new errors (113 pre-existing errors in files not touched — deletedAt, renewedFromLead, alert model, etc.)
- `npm run test`: 122/122 passed (7 test files)
- `npm run build`: compiled successfully in 3.7s, 0 errors, 0 warnings
