import "server-only"
import { prisma } from "@/lib/prisma"
import {
  PipelineStageConfigSchema,
  DEFAULT_STAGE_CONFIG,
  type PipelineStageConfig,
  type StageConfigEntry,
} from "@/lib/stage-config"
import type { PipelineStage } from "@/types"

// Re-export for convenience — callers can import everything from this file
export type { PipelineStageConfig, StageConfigEntry }
export { DEFAULT_STAGE_CONFIG, PipelineStageConfigSchema }

// ── Server-side accessor ─────────────────────────────────────────────────────
// Reads from SystemConfig key `pipeline_stage_config`.
// Falls back to DEFAULT_STAGE_CONFIG if the key is absent or fails validation.

export async function getStageConfig(): Promise<PipelineStageConfig> {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: "pipeline_stage_config" },
    })

    if (!row) return DEFAULT_STAGE_CONFIG

    const parsed = PipelineStageConfigSchema.safeParse(row.value)
    if (!parsed.success) {
      console.warn("[stage-config] stored pipeline_stage_config failed validation — using defaults")
      return DEFAULT_STAGE_CONFIG
    }

    return parsed.data
  } catch (err) {
    console.error("[stage-config] failed to read SystemConfig — using defaults", err)
    return DEFAULT_STAGE_CONFIG
  }
}

// ── Convenience helper ───────────────────────────────────────────────────────

export function stageProbability(
  config: PipelineStageConfig,
  stage: PipelineStage
): number {
  return config[stage].probability
}
