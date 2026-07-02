#!/usr/bin/env node
/**
 * Calibrate win-rate probabilities from LeadStageHistory data.
 *
 * For each PipelineStage, calculates:
 *   win_rate = (leads that touched this stage AND ended in closed_won or invoiced)
 *              / (total leads that touched this stage)
 *
 * Requirements:
 *   - At least 20 total closed leads (closed_won + invoiced) for calibration to apply.
 *   - If threshold not met, default probabilities are used.
 *   - Result probabilities are rounded to nearest 5.
 *
 * Outcome: upserts SystemConfig key `pipeline_stage_config` with the chosen config.
 *
 * Run: node scripts/calibrate-probability.mjs
 *
 * ─── VALIDITY WARNING ────────────────────────────────────────────────────────
 * Calibration is only meaningful if leads genuinely traversed the funnel.
 * If historical data was bulk-imported directly into closed stages (closed_won /
 * invoiced) without going through leads → pipeline → negotiation, the stage
 * history will show 0% touch rates for early stages — making win rates
 * artifacts of the import process, NOT real conversion signals.
 *
 * Before trusting calibrated numbers, verify funnel health first:
 *
 *   SELECT
 *     l.stage,
 *     COUNT(*)                                          AS total_leads,
 *     AVG(transitions.cnt)                             AS avg_transitions_per_lead,
 *     SUM(CASE WHEN transitions.cnt = 0 THEN 1 END)   AS leads_with_no_history
 *   FROM leads l
 *   LEFT JOIN (
 *     SELECT lead_id, COUNT(*) AS cnt FROM lead_stage_history GROUP BY lead_id
 *   ) transitions ON transitions.lead_id = l.id
 *   GROUP BY l.stage;
 *
 * Calibration is trustworthy when:
 *   - avg_transitions_per_lead >= 2 for most active stages
 *   - leads_with_no_history is a small minority (< 20%)
 *
 * If these conditions are not met, the script will still run but you should
 * prefer the default probabilities (leads=10, pipeline=30, negotiation=60,
 * contract_renewal=70, closed_won/invoiced=100, lost_deal/no_response=0)
 * and re-seed via scripts/reseed-stage-config-defaults.mjs instead.
 * ─────────────────────────────────────────────────────────────────────────────
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

const ALL_STAGES = [
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "invoiced",
  "contract_renewal",
  "lost_deal",
  "no_response",
]

const WIN_STAGES = new Set(["closed_won", "invoiced"])

// Stages where probability is always fixed regardless of calibration
const FIXED_STAGES = {
  closed_won: 100,
  invoiced: 100,
  lost_deal: 0,
  no_response: 0,
}

const DEFAULTS = {
  leads: 10,
  pipeline: 30,
  negotiation: 60,
  closed_won: 100,
  invoiced: 100,
  contract_renewal: 70,
  lost_deal: 0,
  no_response: 0,
}

const STAGE_META = {
  leads:             { order: 0, color: "slate",   countsAsForecast: false },
  pipeline:          { order: 1, color: "blue",    countsAsForecast: true  },
  negotiation:       { order: 2, color: "amber",   countsAsForecast: true  },
  closed_won:        { order: 3, color: "green",   countsAsForecast: false },
  invoiced:          { order: 4, color: "emerald", countsAsForecast: false },
  contract_renewal:  { order: 5, color: "violet",  countsAsForecast: true  },
  lost_deal:         { order: 6, color: "red",     countsAsForecast: false },
  no_response:       { order: 7, color: "gray",    countsAsForecast: false },
}

function roundToNearest5(n) {
  return Math.round(n / 5) * 5
}

async function main() {
  console.log("=== Calibrate Stage Probabilities ===\n")

  // Count total leads that ended in a win stage (closed_won or invoiced)
  const closedTotal = await prisma.lead.count({
    where: { stage: { in: ["closed_won", "invoiced"] } },
  })

  console.log(`Total closed leads (closed_won + invoiced): ${closedTotal}`)

  const THRESHOLD = 20
  const useCalibration = closedTotal >= THRESHOLD

  if (!useCalibration) {
    console.log(`\nInsufficient data (< ${THRESHOLD} closed leads). Using default probabilities.\n`)
  } else {
    console.log(`\nData sufficient — running calibration from LeadStageHistory.\n`)
  }

  // ── Funnel health check ───────────────────────────────────────────────────
  // Calibration is only valid if leads genuinely traversed the funnel.
  // Compute per-lead transition count to detect bulk-import artifacts.
  const transitionCounts = await prisma.leadStageHistory.groupBy({
    by: ["leadId"],
    _count: { leadId: true },
  })
  const allLeadCount = await prisma.lead.count()
  const leadsWithHistory = transitionCounts.length
  const leadsWithNoHistory = allLeadCount - leadsWithHistory
  const noHistoryPct = allLeadCount > 0 ? (leadsWithNoHistory / allLeadCount) * 100 : 0
  const avgTransitions =
    leadsWithHistory > 0
      ? transitionCounts.reduce((sum, r) => sum + r._count.leadId, 0) / leadsWithHistory
      : 0

  console.log("── Funnel Health Check ─────────────────────────────────────────")
  console.log(`  Total leads:              ${allLeadCount}`)
  console.log(`  Leads with stage history: ${leadsWithHistory}`)
  console.log(`  Leads with NO history:    ${leadsWithNoHistory} (${noHistoryPct.toFixed(1)}%)`)
  console.log(`  Avg transitions/lead:     ${avgTransitions.toFixed(2)}`)

  const funnelHealthy = noHistoryPct < 20 && avgTransitions >= 2
  if (!funnelHealthy) {
    console.log("")
    console.log("  *** WARNING: Funnel data may be import artifacts ***")
    console.log("  Calibration results below should NOT be trusted if:")
    console.log("    - Most leads went directly to closed stages without traversing the funnel")
    console.log("    - avg_transitions is < 2 (leads were never moved through stages)")
    console.log("    - > 20% of leads have no history at all")
    console.log("")
    console.log("  Consider using defaults instead:")
    console.log("    node scripts/reseed-stage-config-defaults.mjs")
    console.log("")
  } else {
    console.log("  Funnel health: OK — calibration results are likely valid.")
    console.log("")
  }
  console.log("────────────────────────────────────────────────────────────────\n")

  // Build stage → set of leadIds that touched it
  // We read ALL stage history to build per-stage touch sets
  const allHistory = await prisma.leadStageHistory.findMany({
    select: { leadId: true, fromStage: true, toStage: true },
  })

  // leadId → final stage
  const leadFinalStage = {}
  const allLeads = await prisma.lead.findMany({ select: { id: true, stage: true } })
  for (const l of allLeads) {
    leadFinalStage[l.id] = l.stage
  }

  // stage → Set<leadId> of all leads that ever touched this stage
  const stageTouched = {}
  for (const s of ALL_STAGES) stageTouched[s] = new Set()

  // A lead "touches" a stage if it was the fromStage or toStage in history,
  // OR if its current stage is that stage.
  for (const h of allHistory) {
    stageTouched[h.fromStage]?.add(h.leadId)
    stageTouched[h.toStage]?.add(h.leadId)
  }
  // Also include current stage (leads that were created directly in a stage
  // and never moved)
  for (const l of allLeads) {
    stageTouched[l.stage]?.add(l.id)
  }

  const probabilities = {}
  const report = []

  for (const stage of ALL_STAGES) {
    // Fixed stages always use their constant
    if (stage in FIXED_STAGES) {
      probabilities[stage] = FIXED_STAGES[stage]
      report.push({
        stage,
        touched: stageTouched[stage].size,
        wins: "N/A",
        rawRate: "N/A",
        calibrated: FIXED_STAGES[stage],
        source: "fixed",
      })
      continue
    }

    if (!useCalibration) {
      probabilities[stage] = DEFAULTS[stage]
      report.push({
        stage,
        touched: stageTouched[stage].size,
        wins: "N/A",
        rawRate: "N/A",
        calibrated: DEFAULTS[stage],
        source: "default",
      })
      continue
    }

    const touchedSet = stageTouched[stage]
    const touchedCount = touchedSet.size

    if (touchedCount === 0) {
      probabilities[stage] = DEFAULTS[stage]
      report.push({
        stage,
        touched: 0,
        wins: 0,
        rawRate: "0%",
        calibrated: DEFAULTS[stage],
        source: "default (no data)",
      })
      continue
    }

    // Count how many leads that touched this stage ended in a win stage
    let wins = 0
    for (const leadId of touchedSet) {
      const finalStage = leadFinalStage[leadId]
      if (finalStage && WIN_STAGES.has(finalStage)) {
        wins++
      }
    }

    const rawRate = wins / touchedCount
    const calibrated = roundToNearest5(rawRate * 100)
    // Clamp to [5, 95] for non-terminal stages so no stage goes to 0 or 100 unintentionally
    const clamped = Math.max(5, Math.min(95, calibrated))
    probabilities[stage] = clamped

    report.push({
      stage,
      touched: touchedCount,
      wins,
      rawRate: `${(rawRate * 100).toFixed(1)}%`,
      calibrated: clamped,
      source: "calibrated",
    })
  }

  // Print report table
  console.log("Stage               | Touched | Wins  | Raw Rate | Probability | Source")
  console.log("-".repeat(82))
  for (const row of report) {
    console.log(
      `${row.stage.padEnd(20)}| ${String(row.touched).padEnd(8)}| ${String(row.wins).padEnd(6)}| ${String(row.rawRate).padEnd(9)}| ${String(row.calibrated).padEnd(12)}| ${row.source}`
    )
  }

  // Build full config object
  const stageConfig = {}
  for (const stage of ALL_STAGES) {
    stageConfig[stage] = {
      probability: probabilities[stage],
      ...STAGE_META[stage],
    }
  }

  console.log("\nUpserting pipeline_stage_config into SystemConfig...")
  await prisma.systemConfig.upsert({
    where: { key: "pipeline_stage_config" },
    update: { value: stageConfig },
    create: { key: "pipeline_stage_config", value: stageConfig },
  })

  console.log("Done. pipeline_stage_config seeded.\n")
  console.log(
    useCalibration
      ? `Used CALIBRATED probabilities (${closedTotal} closed leads found).`
      : `Used DEFAULT probabilities (only ${closedTotal} closed leads — threshold is ${THRESHOLD}).`
  )
}

main().catch(console.error).finally(() => prisma.$disconnect())
