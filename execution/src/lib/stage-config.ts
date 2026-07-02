import { z } from "zod"
import type { PipelineStage } from "@/types"

// ── Zod schema for a single stage entry ────────────────────────────────────
// Client-safe: no Prisma, no server-only imports.
// Server-side accessor lives in stage-config.server.ts.

export const StageConfigEntrySchema = z.object({
  probability: z.number().min(0).max(100),
  order: z.number().int().min(0),
  color: z.string().min(1),
  countsAsForecast: z.boolean(),
})

export type StageConfigEntry = z.infer<typeof StageConfigEntrySchema>

export const PipelineStageConfigSchema = z.object({
  leads: StageConfigEntrySchema,
  pipeline: StageConfigEntrySchema,
  negotiation: StageConfigEntrySchema,
  closed_won: StageConfigEntrySchema,
  invoiced: StageConfigEntrySchema,
  contract_renewal: StageConfigEntrySchema,
  lost_deal: StageConfigEntrySchema,
  no_response: StageConfigEntrySchema,
})

export type PipelineStageConfig = z.infer<typeof PipelineStageConfigSchema>

// ── Hardcoded defaults ───────────────────────────────────────────────────────
// Used as fallback when SystemConfig key is absent or fails validation.

export const DEFAULT_STAGE_CONFIG: PipelineStageConfig = {
  leads: { probability: 10, order: 0, color: "slate", countsAsForecast: false },
  pipeline: { probability: 30, order: 1, color: "blue", countsAsForecast: true },
  negotiation: { probability: 60, order: 2, color: "amber", countsAsForecast: true },
  closed_won: { probability: 100, order: 3, color: "green", countsAsForecast: false },
  invoiced: { probability: 100, order: 4, color: "emerald", countsAsForecast: false },
  contract_renewal: { probability: 70, order: 5, color: "violet", countsAsForecast: true },
  lost_deal: { probability: 0, order: 6, color: "red", countsAsForecast: false },
  no_response: { probability: 0, order: 7, color: "gray", countsAsForecast: false },
}

// ── Convenience helper ───────────────────────────────────────────────────────
// Pure function — safe for client components.

export function stageProbability(
  config: PipelineStageConfig,
  stage: PipelineStage
): number {
  return config[stage].probability
}
