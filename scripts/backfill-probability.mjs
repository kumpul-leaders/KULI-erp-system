#!/usr/bin/env node
/**
 * Backfill probability for all existing Lead rows.
 *
 * Logic:
 *   - Reads pipeline_stage_config from SystemConfig (or falls back to defaults).
 *   - For each Lead where probabilityIsManual = false (or probability is null),
 *     sets probability = config[lead.stage].probability.
 *   - Never overwrites probabilityIsManual = true rows.
 *
 * Run: node scripts/backfill-probability.mjs
 * Safe to re-run (idempotent — only touches auto-managed leads).
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })
config({ path: resolve(__dirname, "../.env.local"), override: true })

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const DEFAULT_CONFIG = {
  leads:             { probability: 10 },
  pipeline:          { probability: 30 },
  negotiation:       { probability: 60 },
  closed_won:        { probability: 100 },
  invoiced:          { probability: 100 },
  contract_renewal:  { probability: 70 },
  lost_deal:         { probability: 0 },
  no_response:       { probability: 0 },
}

async function readStageConfig() {
  try {
    const row = await prisma.systemConfig.findUnique({
      where: { key: "pipeline_stage_config" },
    })
    if (!row || typeof row.value !== "object" || row.value === null) {
      console.log("pipeline_stage_config not found — using hardcoded defaults")
      return DEFAULT_CONFIG
    }
    const value = row.value
    // Validate all stages present
    const stages = Object.keys(DEFAULT_CONFIG)
    for (const s of stages) {
      if (!(s in value) || typeof value[s]?.probability !== "number") {
        console.log(`Invalid config for stage ${s} — using hardcoded defaults`)
        return DEFAULT_CONFIG
      }
    }
    return value
  } catch {
    return DEFAULT_CONFIG
  }
}

async function main() {
  console.log("=== Backfill Lead Probabilities ===\n")

  const stageConfig = await readStageConfig()
  console.log("Stage config loaded:")
  for (const [stage, cfg] of Object.entries(stageConfig)) {
    console.log(`  ${stage.padEnd(22)}: ${cfg.probability}%`)
  }
  console.log("")

  // Fetch all leads where probability should be auto-managed
  // (probabilityIsManual = false OR probability is null)
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { probabilityIsManual: false },
        { probability: null },
      ],
    },
    select: { id: true, stage: true, probabilityIsManual: true, probability: true },
  })

  console.log(`Found ${leads.length} leads to backfill (probabilityIsManual = false or probability null)\n`)

  if (leads.length === 0) {
    console.log("Nothing to do.")
    return
  }

  // Group by stage for batch update efficiency
  const byStage = {}
  for (const lead of leads) {
    if (!byStage[lead.stage]) byStage[lead.stage] = []
    byStage[lead.stage].push(lead.id)
  }

  let totalUpdated = 0

  for (const [stage, ids] of Object.entries(byStage)) {
    const probability = stageConfig[stage]?.probability ?? DEFAULT_CONFIG[stage]?.probability ?? 0
    const result = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { probability, probabilityIsManual: false },
    })
    console.log(`  ${stage.padEnd(22)}: updated ${result.count} leads → probability = ${probability}%`)
    totalUpdated += result.count
  }

  console.log(`\nBackfill complete. Total rows updated: ${totalUpdated}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
