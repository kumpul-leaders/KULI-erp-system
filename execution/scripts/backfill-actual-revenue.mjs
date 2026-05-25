/**
 * Backfill actualRevenue for all INVOICED leads where actualRevenue is null.
 *
 * Business rule:
 *   When a lead reaches the "invoiced" stage and actualRevenue is not set,
 *   default actualRevenue = projectedRevenue.
 *   Leads where projectedRevenue is also null are skipped.
 *
 * Run: cd /Users/williamsudhana/VF\ ERP\ System/execution && node scripts/backfill-actual-revenue.mjs
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      stage: "invoiced",
      actualRevenue: null,
    },
    select: { id: true, projectedRevenue: true },
  })

  console.log(`Found ${leads.length} invoiced leads with actualRevenue = null`)

  const counts = { updated: 0, skipped: 0, errors: 0 }
  const errors = []

  for (const lead of leads) {
    if (lead.projectedRevenue === null) {
      counts.skipped++
      process.stdout.write("s")
      continue
    }

    try {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { actualRevenue: lead.projectedRevenue },
      })
      counts.updated++
      process.stdout.write(".")
    } catch (err) {
      counts.errors++
      errors.push({ id: lead.id, error: err.message })
      process.stdout.write("x")
    }
  }

  console.log(`\n\nDone.`)
  console.log(`  updated: ${counts.updated}`)
  console.log(`  skipped: ${counts.skipped}  (projectedRevenue was also null)`)
  console.log(`  errors:  ${counts.errors}`)

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    for (const e of errors) {
      console.log(`  [${e.id}]: ${e.error}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error("Fatal:", err)
  await prisma.$disconnect()
  process.exit(1)
})
