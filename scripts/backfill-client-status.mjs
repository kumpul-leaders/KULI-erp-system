/**
 * Backfill clientStatus for all clients from Lead data.
 *
 * Business rules (mirrors client-status.ts):
 *   active   = at least one lead currently active (per project type + time checks)
 *              one_time  → stage = closed_won only  (invoiced = done and billed)
 *              retainer  → stage in (closed_won | invoiced | contract_renewal)
 *                          AND contractEnd >= today  (if contractEnd is set)
 *                          AND billingPlan within last 3 months  (if contractEnd not set)
 *   inactive = no active lead, but has evidence of a past winning engagement
 *   lead     = no evidence of ever winning a deal
 *
 * Run: cd /Users/williamsudhana/VF\ ERP\ System/execution && node scripts/backfill-client-status.mjs
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load execution/.env — use DIRECT_URL (port 5432, no pgbouncer) for script reliability
config({ path: resolve(__dirname, "../.env") })

const connectionString = process.env.DIRECT_URL
if (!connectionString) {
  throw new Error("DIRECT_URL not found in .env")
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// ── Business logic (mirrors client-status.ts) ────────────────────────────────

const RETAINER_ACTIVE_STAGES = ["closed_won", "invoiced", "contract_renewal"]
const ONE_TIME_ACTIVE_STAGES = ["closed_won"]
const WIN_EVIDENCE_STAGES = ["closed_won", "invoiced", "contract_renewal"]
const RETAINER_GRACE_MONTHS = 3

function parseBillingMonth(billingPlan) {
  if (!billingPlan) return null
  const parts = billingPlan.split("-")
  if (parts.length !== 2) return null
  const yy = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (isNaN(yy) || isNaN(mm) || mm < 1 || mm > 12) return null
  return new Date(2000 + yy, mm - 1, 1)
}

function monthsElapsed(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function isRetainerLeadCurrentlyActive(lead, contractEnd, today) {
  if (!RETAINER_ACTIVE_STAGES.includes(lead.stage)) return false
  if (contractEnd !== null && contractEnd < today) return false
  if (contractEnd === null && lead.billingPlan !== null) {
    const billingDate = parseBillingMonth(lead.billingPlan)
    if (billingDate !== null && monthsElapsed(billingDate, today) > RETAINER_GRACE_MONTHS) {
      return false
    }
  }
  return true
}

function computeStatus(leads, contractEnd, today) {
  const isActive = leads.some((l) => {
    if (l.projectType === "retainer") {
      return isRetainerLeadCurrentlyActive(l, contractEnd, today)
    }
    return ONE_TIME_ACTIVE_STAGES.includes(l.stage)
  })

  if (isActive) return "active"
  if (leads.some((l) => WIN_EVIDENCE_STAGES.includes(l.stage))) return "inactive"
  return "lead"
}

async function computeAndSync(client, today) {
  const leads = await prisma.lead.findMany({
    where: { clientId: client.id },
    select: {
      stage: true,
      projectType: true,
      billingPlan: true,
    },
  })

  const contractEnd = client.contractEnd ? new Date(client.contractEnd) : null
  const status = computeStatus(leads, contractEnd, today)

  await prisma.client.update({
    where: { id: client.id },
    data: { clientStatus: status },
  })

  return status
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date()
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, contractEnd: true },
  })

  console.log(`Syncing ${clients.length} clients... (today: ${today.toISOString().slice(0, 10)})`)

  const counts = { active: 0, inactive: 0, lead: 0 }
  const errors = []

  for (const c of clients) {
    try {
      const status = await computeAndSync(c, today)
      counts[status]++
      process.stdout.write(".")
    } catch (err) {
      errors.push({ id: c.id, name: c.name, error: err.message })
      process.stdout.write("x")
    }
  }

  console.log(`\n\nDone.`)
  console.log(`  active:   ${counts.active}`)
  console.log(`  inactive: ${counts.inactive}`)
  console.log(`  lead:     ${counts.lead}`)
  console.log(`  total:    ${counts.active + counts.inactive + counts.lead}`)

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    for (const e of errors) {
      console.log(`  [${e.id}] ${e.name}: ${e.error}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("Fatal:", err)
  await prisma.$disconnect()
  process.exit(1)
})
