# WEBO Build Notes — Phase 1 Batch 2A (Pipeline Components)
Date: 2026-07-02

## Files Changed

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Added `formatIDRCompact()` — Rp 15jt / Rp 1,2M / Rp 500rb format for dense UI |
| `src/lib/stage-config.ts` | Removed Prisma import + `getStageConfig()` — now client-safe (Zod schemas + defaults only) |
| `src/lib/stage-config.server.ts` | NEW — server-only module with `getStageConfig()` + `"server-only"` directive. Fixes bundler pulling pg/tls into client chunk via settings-pipeline-tab.tsx |
| `src/components/pipeline/pipeline-card.tsx` | (1) Added `probability`, `probabilityIsManual`, `lostReason` to `SerializedLead`. (2) Probability badge with Manual indicator + tooltip. (3) `LOST_REASON_LABELS` constant (exported). (4) `lostReason` badge on `lost_deal` cards |
| `src/components/pipeline/pipeline-kanban.tsx` | (1) Column header stats: count · total revenue · weighted revenue (formatIDRCompact). (2) `LostDealDialog` upgraded: Select (6 enum options, Indonesian labels) + optional textarea note. Both wired to `performStageChange` with `{ lostReason, lossDealReason }` payload |
| `src/components/pipeline/pipeline-kanban-loader.tsx` | Added `clientOptions` derived from loaded leads + `clientId` enum field to `pipelineFieldConfigs` |
| `src/components/pipeline/lead-detail-client.tsx` | (1) Added `probability`, `probabilityIsManual`, `lostReason` to `SerializedLead`. (2) `ProbabilityInline` + `ProbabilityField` components (inline edit 0–100, Reset ke otomatis button shown only when manual). (3) `LostReasonField` (editable Select + textarea, badge display). (4) `StageActions` upgraded: structured lostReason Select + note textarea in AlertDialog. (5) `showLossDealReason` → `showLostReason`, rendered as `LostReasonField` |
| `src/app/(dashboard)/pipeline/[id]/page.tsx` | Serialization: added `probability`, `probabilityIsManual`, `lostReason` to `serializedLead` object |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Leads smart button now links to `/pipeline?filter=<base64 clientId FilterCondition>` |
| `src/app/api/leads/[id]/stage/route.ts` | (1) Destructures `lostReason` from `StageTransitionSchema`. (2) Gate check uses `lossDealReason ?? lostReason` as fallback. (3) Persists `lostReason` on `lost_deal` transition |
| `src/lib/validations/lead.ts` | `StageTransitionSchema` now includes `lostReason: LostReasonSchema.optional().nullable()` |
| `src/app/(dashboard)/dashboard/page.tsx` | Fixed pre-existing TS error: `forecastStages` cast to `PipelineStage[]` + updated getStageConfig import |
| `src/app/(dashboard)/targets/page.tsx` | Fixed pre-existing TS error: `forecastStages` cast to `$Enums.PipelineStage[]` + updated getStageConfig import |
| `src/app/(dashboard)/settings/page.tsx` | Updated getStageConfig import to stage-config.server |
| All API routes using getStageConfig | Import path updated from `@/lib/stage-config` to `@/lib/stage-config.server` |

## Key Decisions

1. **`formatIDRCompact` pattern**: rb (ribu) / jt (juta) / M (miliar). Column header shows `{count}` on top row, revenue stats on second row with separator dot. Weighted shown with ~ prefix to signal estimation.

2. **Probability badge**: Auto = neutral grey `bg-neutral-100 text-neutral-500`. Manual = amber `bg-warning-100 text-warning-700` with pencil icon. Tooltip on both.

3. **LostDealDialog upgrade**: Select (required) + textarea (optional). Submit sends `{ lostReason: LostReason, lossDealReason: string }`. `lossDealReason` defaults to Indonesian label string if note is empty, preserving backward compat with existing gate check (`lossDealReason?.trim()` check).

4. **`stage-config.ts` split**: Client components (settings-pipeline-tab.tsx) import Zod schema + defaults from `stage-config.ts`. Server components/routes import `getStageConfig` from `stage-config.server.ts`. This prevents pg/tls from being bundled for the browser.

5. **clientId filter**: Derived client options from already-loaded leads (`Map<clientId, name>`). No extra API call. `clientId` maps directly to `lead.clientId` via the existing fallback in `getLeadValue`. URL uses `btoa(JSON.stringify([FilterCondition]))` — same encoding the filter panel reads from URL params.

6. **`ProbabilityField` wrapper pattern**: `ProbabilityInline` handles the edit form. A thin `ProbabilityField` wrapper adds the "Reset ke otomatis" button below it — avoids passing reset callback as prop through `InlineField` which has a fixed slot structure.

## Verification

- `npx tsc --noEmit`: 0 errors
- `npm run test`: 69/69 passed
- `npm run build`: clean, all 19 routes built
