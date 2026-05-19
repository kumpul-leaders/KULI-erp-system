/**
 * Backfill clientStatus for all 291 clients from Lead + LeadStageHistory data.
 *
 * Business rules:
 *   active   = client has at least one Lead currently in closed_won | invoiced | contract_renewal
 *   inactive = no currently active lead, but stageHistory shows a win ever reached
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

const ACTIVE_STAGES = ["closed_won", "invoiced", "contract_renewal"]

async function computeAndSync(clientId) {
  const leads = await prisma.lead.findMany({
    where: { clientId },
    select: {
      stage: true,
      stageHistory: {
        where: { toStage: { in: ACTIVE_STAGES } },
        select: { id: true },
        take: 1,
      },
    },
  })

  let status
  if (leads.some((l) => ACTIVE_STAGES.includes(l.stage))) {
    status = "active"
  } else if (leads.some((l) => l.stageHistory.length > 0)) {
    status = "inactive"
  } else {
    status = "lead"
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { clientStatus: status },
  })

  return status
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
  })

  console.log(`Syncing ${clients.length} clients...`)

  const counts = { active: 0, inactive: 0, lead: 0 }
  const errors = []

  for (const c of clients) {
    try {
      const status = await computeAndSync(c.id)
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
