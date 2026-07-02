# WEBO Build Notes — Lead Probability & LostReason
Date: 2026-07-02

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `probability Decimal? @db.Decimal(5,2)`, `probabilityIsManual Boolean @default(false)`, `lostReason LostReason?`, `enum LostReason { budget competitor timing no_decision requirements_mismatch other }` |
| `prisma/migrations/20260702104319_add_lead_probability_lost_reason/migration.sql` | Migration applied |
| `src/lib/stage-config.ts` | New file — Zod schema, `getStageConfig()`, `DEFAULT_STAGE_CONFIG`, `stageProbability()` |
| `src/lib/validations/lead.ts` | Added `LostReasonSchema`, `probability` + `probabilityIsManual` + `lostReason` to `UpdateLeadSchema`; `lostReason` to `CreateLeadSchema` |
| `src/app/api/leads/route.ts` | serializeLead updated for new fields; POST sets initial probability from stage config |
| `src/app/api/leads/[id]/route.ts` | serializeLead updated; PATCH handles probability override/reset/lostReason |
| `src/app/api/leads/[id]/stage/route.ts` | Auto-sets probability on stage change if `probabilityIsManual = false` |
| `src/app/api/system-config/[key]/route.ts` | Added `pipeline_stage_config` to ALLOWED_KEYS |
| `src/types/index.ts` | Added `LostReason` type; updated `Lead` interface with `probability`, `probabilityIsManual`, `lostReason`, `expectedCloseDate` |
| `src/lib/validations/__tests__/lead.test.ts` | 12 new tests for LostReasonSchema, probability fields, lostReason in Create/Update |
| `scripts/calibrate-probability.mjs` | Calibration script — reads LeadStageHistory, computes win rates, seeds pipeline_stage_config |
| `scripts/backfill-probability.mjs` | Backfill script — applied to all 501 existing leads |

## Key Decisions

1. **Probability is Decimal(5,2) in DB, number in JSON.** Serialized via `Number()` in all three route serializers — same pattern as projectedRevenue/actualRevenue.

2. **`lostReason` (enum) is additive alongside `lossDealReason` (string).** `lossDealReason` stays for backward compat (existing gate/stage logic checks it). `lostReason` is the new typed field for structured reporting.

3. **Reset via `probabilityIsManual: false`.** Sending `{ probabilityIsManual: false }` in PATCH re-applies the stage default from SystemConfig. Sending `{ probability: N }` sets the value and auto-marks `probabilityIsManual: true`. These two signals are handled independently in the route.

4. **`getStageConfig()` hits DB on every call.** No in-memory cache. This is a server component / API route context — Next.js cache layer handles dedup within a request. Keep it simple.

5. **`pipeline_stage_config` added to system-config allowlist.** Admins/Directors can update it via `PATCH /api/system-config/pipeline_stage_config`.

## Calibration Result (2026-07-02)

255 closed leads found — threshold (20) met, calibration applied.

| Stage | Touched | Win Rate | Result | Source |
|-------|---------|----------|--------|--------|
| leads | 29 | 0.0% | 5% (clamped) | calibrated |
| pipeline | 64 | 0.0% | 5% (clamped) | calibrated |
| negotiation | 0 | — | 60% | default (no history) |
| closed_won | 40 | — | 100% | fixed |
| invoiced | 215 | — | 100% | fixed |
| contract_renewal | 19 | 0.0% | 5% (clamped) | calibrated |
| lost_deal | 110 | — | 0% | fixed |
| no_response | 25 | — | 0% | fixed |

Note: 0% win rates on leads/pipeline/contract_renewal indicate historical data was imported directly to closed/invoiced states without going through the funnel. The 5% floor prevents false 0-probability on active stages.

## Test Results

- tsc --noEmit: 0 errors
- npm run test: 69/69 passed (57 pre-existing + 12 new)
- npm run build: clean, 37 routes compiled
