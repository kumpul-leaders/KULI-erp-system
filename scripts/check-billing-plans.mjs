#!/usr/bin/env node
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

async function main() {
  const leads = await prisma.lead.findMany({
    where: { billingPlan: { not: null } },
    select: { billingPlan: true, stage: true, actualRevenue: true, projectedRevenue: true },
    orderBy: { billingPlan: "asc" },
  })
  console.log("Total leads with billingPlan:", leads.length)
  console.log(JSON.stringify(leads, null, 2))
  await prisma.$disconnect()
}
main().catch(console.error)
