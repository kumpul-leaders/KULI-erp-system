// import-pipeline.mjs — Import Sales Pipeline CSV → Supabase
// Idempotent: clears all leads before re-importing.
// Run: node scripts/import-pipeline.mjs

import { createReadStream } from "fs"
import { parse } from "csv-parse"
import path from "path"
import { fileURLToPath } from "url"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import * as dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const DIRECT_URL = process.env.DIRECT_URL
if (!DIRECT_URL) throw new Error("DIRECT_URL not set in .env")

const pool = new pg.Pool({ connectionString: DIRECT_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const CSV_PATH = path.resolve(__dirname, "../../Data/Sales Pipeline.csv")

// ── Stage mapping ────────────────────────────────────────────────────────────

function mapStage(raw) {
  const s = raw.trim()
  if (s.includes("Hot Lead") || s.includes("Potential Lead") || s.includes("Cold Lead") || s === "") return "leads"
  if (s.includes("Pipeline")) return "pipeline"
  if (s.includes("Close won") || s.includes("Close Won")) return "closed_won"
  if (s.includes("Invoiced") || s.includes("Invoiced")) return "invoiced"
  if (s.includes("Loss Deal") || s.includes("Lost Deal")) return "lost_deal"
  if (s.includes("Contract Extension") || s.includes("Contract Renewal")) return "contract_renewal"
  if (s.includes("No Response")) return "no_response"
  return "leads"
}

// ── Product line mapping ─────────────────────────────────────────────────────

const PRODUCT_LINE_MAP = {
  "SMM": "smm",
  "SMM Lite": "smm",
  "Ads Marketing": "ads_management",
  "360 Marketing": "stracomm",
  "Blueprint Strategy": "stracomm",
  "Content Plan": "smm",
  "Content Placement": "media_buying",
  "Influencer Marketing": "media_buying",
  "Brand Activation": "creative_strategy",
  "Design Production": "production",
  "Photo Production": "production",
  "Video Production": "production",
  "Live Streaming": "production",
  "Digital Revamp": "stracomm",
  "Corporate Training": "others",
  "Private Consultation": "others",
  "Refferal Fee": "others",
  "Referral Fee": "others",
  "Web Development": "others",
  "Others": "others",
}

function mapProductLine(raw) {
  const trimmed = raw.trim()
  return PRODUCT_LINE_MAP[trimmed] ?? "others"
}

// ── Quarter calculation ──────────────────────────────────────────────────────

function billingPlanToQuarter(bp) {
  if (!bp) return null
  const match = bp.match(/^(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = 2000 + parseInt(match[1])
  const month = parseInt(match[2])
  if (month < 1 || month > 12) return null
  const q = Math.ceil(month / 3)
  return `Q${q} ${year}`
}

// ── Revenue parsing ──────────────────────────────────────────────────────────

function parseRevenue(raw) {
  if (!raw || !raw.trim()) return null
  const num = parseFloat(raw.trim())
  if (isNaN(num)) return null
  return Math.round(num)
}

// ── Date parsing (DD/MM/YYYY) ────────────────────────────────────────────────

function parseDate(raw) {
  if (!raw || !raw.trim()) return null
  const parts = raw.trim().split("/")
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
  return isNaN(d.getTime()) ? null : d
}

// ── AE name upsert ───────────────────────────────────────────────────────────

const aeCache = {}

async function resolveAe(name) {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  if (aeCache[trimmed]) return aeCache[trimmed]

  const parts = trimmed.toLowerCase().split(/\s+/)
  const email = parts.join(".") + "@vosfoyerid.com"

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: trimmed, role: "account" },
    update: { name: trimmed },
    select: { id: true },
  })
  aeCache[trimmed] = user.id
  return user.id
}

// ── Client lookup / placeholder creation ────────────────────────────────────

const clientCache = {}

async function resolveClient(name) {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  if (clientCache[trimmed]) return clientCache[trimmed]

  let client = await prisma.client.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  })

  if (!client) {
    // Create placeholder client
    client = await prisma.client.create({
      data: {
        name: trimmed,
        engagementType: "project",
        healthStatus: "healthy",
        customerCode: await generateCode(trimmed),
      },
      select: { id: true },
    })
  }

  clientCache[trimmed] = client.id
  return client.id
}

// ── Customer code generator (same algorithm as import-clients.mjs) ───────────

const usedCodes = new Set()

async function generateCode(name) {
  // Pre-load existing codes on first call
  if (usedCodes.size === 0) {
    const existing = await prisma.client.findMany({ select: { customerCode: true } })
    existing.forEach((c) => { if (c.customerCode) usedCodes.add(c.customerCode) })
  }

  const SKIP = /\b(PT|CV|TBK|TBk|THE|AND|&|INDONESIA|GROUP)\b/gi
  const cleaned = name.replace(SKIP, "").replace(/[^A-Za-z\s]/g, "").trim()
  const words = cleaned.split(/\s+/).filter(Boolean)

  let base
  if (words.length === 1) {
    base = words[0].substring(0, 4).toUpperCase()
  } else if (words.length === 2) {
    base = (words[0].substring(0, 3) + words[1].substring(0, 1)).toUpperCase()
  } else {
    base = (words[0].substring(0, 2) + words[words.length - 1].substring(0, 2)).toUpperCase()
  }
  if (!base || base.length < 2) base = name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, "")

  let code = base
  let counter = 2
  while (usedCodes.has(code)) {
    code = base + counter
    counter++
  }
  usedCodes.add(code)
  return code
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Reading CSV:", CSV_PATH)

  // Parse CSV
  const rows = await new Promise((resolve, reject) => {
    const records = []
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true }))
      .on("data", (row) => records.push(row))
      .on("end", () => resolve(records))
      .on("error", reject)
  })

  console.log(`Parsed ${rows.length} rows`)

  // Clear existing leads (idempotent)
  const deleted = await prisma.lead.deleteMany()
  console.log(`Cleared ${deleted.count} existing leads`)

  let created = 0
  let skipped = 0
  const skipReasons = []

  for (const row of rows) {
    const clientName = (row["Corresponding client"] || "").trim()
    const productLineRaw = (row["Product line"] || "").trim()
    const typeRaw = (row["Type"] || "").trim()
    const stageRaw = (row["Stage"] || "").trim()
    const salesName = (row["Sales"] || "").trim()
    const billingPlan = (row["Billing Plan"] || "").trim()
    const opportunityValue = (row["Opportunity value"] || "").trim()
    const description = (row["Project Description"] || "").trim()
    const lossDealReason = (row["Loss Deal Reason"] || "").trim()
    const progressNote = (row["Progress Note"] || "").trim()
    const createdOnRaw = (row["Created on"] || "").trim()

    // Require client name
    if (!clientName) {
      skipped++
      skipReasons.push(`Row skipped — no client name`)
      continue
    }

    // Map projectType — default one_time if empty
    let projectType = "one_time"
    if (typeRaw.toLowerCase() === "retainer") projectType = "retainer"

    const stage = mapStage(stageRaw)
    const productLine = mapProductLine(productLineRaw)
    const quarter = billingPlanToQuarter(billingPlan) ?? null
    const projectedRevenue = parseRevenue(opportunityValue)
    const createdAt = parseDate(createdOnRaw)

    const clientId = await resolveClient(clientName)
    if (!clientId) {
      skipped++
      skipReasons.push(`Row skipped — could not resolve client: ${clientName}`)
      continue
    }

    const salesId = await resolveAe(salesName)

    await prisma.lead.create({
      data: {
        clientId,
        productLine,
        description: description || null,
        projectType,
        stage,
        salesId,
        projectedRevenue,
        billingPlan: billingPlan || null,
        quarter,
        lossDealReason: lossDealReason || null,
        notes: progressNote || null,
        createdAt: createdAt ?? undefined,
        closedAt:
          stage === "closed_won" || stage === "lost_deal" || stage === "invoiced"
            ? (createdAt ?? new Date())
            : null,
      },
    })

    created++
    if (created % 50 === 0) process.stdout.write(`  ...${created} leads imported\n`)
  }

  console.log(`\n✓ Import complete`)
  console.log(`  Created: ${created} leads`)
  console.log(`  Skipped: ${skipped} rows`)
  if (skipReasons.length > 0) {
    console.log(`\nSkip details (first 10):`)
    skipReasons.slice(0, 10).forEach((r) => console.log(`  - ${r}`))
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch((err) => {
  console.error("Import failed:", err)
  process.exit(1)
})
