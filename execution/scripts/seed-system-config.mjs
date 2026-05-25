#!/usr/bin/env node
/**
 * Seed script: upsert SystemConfig rows for stage_gates and product_line_labels.
 * Run: node scripts/seed-system-config.mjs
 * Idempotent — safe to run multiple times.
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

const STAGE_GATES = [
  { from: "Leads → Pipeline", gate: "Quotation document" },
  { from: "Pipeline → Negotiation", gate: "None" },
  { from: "Negotiation → Closed Won", gate: "Signed Quotation" },
  { from: "Closed Won → Invoiced", gate: "None" },
  { from: "Invoiced → Contract Renewal", gate: "None" },
  { from: "Any → Lost Deal", gate: "None" },
  { from: "Any → No Response", gate: "None" },
]

const PRODUCT_LINE_LABELS = {
  smm: "Social Media Management",
  stracomm: "Stracomm",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Management",
  production: "Production",
  others: "Others",
}

async function main() {
  console.log("Seeding system_config...")

  await prisma.systemConfig.upsert({
    where: { key: "stage_gates" },
    update: { value: STAGE_GATES },
    create: { key: "stage_gates", value: STAGE_GATES },
  })
  console.log("✓ stage_gates upserted")

  await prisma.systemConfig.upsert({
    where: { key: "product_line_labels" },
    update: { value: PRODUCT_LINE_LABELS },
    create: { key: "product_line_labels", value: PRODUCT_LINE_LABELS },
  })
  console.log("✓ product_line_labels upserted")

  console.log("Done.")
}

main().catch(console.error).finally(() => prisma.$disconnect())
