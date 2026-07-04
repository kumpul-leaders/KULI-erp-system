#!/usr/bin/env node
/**
 * One-shot re-seed: overwrite pipeline_stage_config with corrected default probabilities.
 *
 * Reason: historical data was imported directly into closed stages (closed_won/invoiced)
 * without traversing the funnel. Win rates from LeadStageHistory are therefore artifacts
 * of the import process, not real conversion signals. calibrate-probability.mjs produced
 * floor-clamped 5% for leads/pipeline/contract_renewal — this would make weighted forecast
 * nearly zero and misleading.
 *
 * Corrected values (industry baseline defaults):
 *   leads=10, pipeline=30, negotiation=60, contract_renewal=70,
 *   closed_won=100, invoiced=100, lost_deal=0, no_response=0
 *
 * Run: node scripts/reseed-stage-config-defaults.mjs
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

const STAGE_CONFIG = {
  leads:            { probability: 10,  order: 0, color: "slate",   countsAsForecast: false },
  pipeline:         { probability: 30,  order: 1, color: "blue",    countsAsForecast: true  },
  negotiation:      { probability: 60,  order: 2, color: "amber",   countsAsForecast: true  },
  closed_won:       { probability: 100, order: 3, color: "green",   countsAsForecast: false },
  invoiced:         { probability: 100, order: 4, color: "emerald", countsAsForecast: false },
  contract_renewal: { probability: 70,  order: 5, color: "violet",  countsAsForecast: true  },
  lost_deal:        { probability: 0,   order: 6, color: "red",     countsAsForecast: false },
  no_response:      { probability: 0,   order: 7, color: "gray",    countsAsForecast: false },
}

async function main() {
  console.log("Re-seeding pipeline_stage_config with corrected defaults...\n")

  for (const [stage, cfg] of Object.entries(STAGE_CONFIG)) {
    console.log(`  ${stage.padEnd(22)}: probability = ${cfg.probability}%`)
  }

  await prisma.systemConfig.upsert({
    where: { key: "pipeline_stage_config" },
    update: { value: STAGE_CONFIG },
    create: { key: "pipeline_stage_config", value: STAGE_CONFIG },
  })

  console.log("\npipeline_stage_config upserted.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
