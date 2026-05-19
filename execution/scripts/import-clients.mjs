/**
 * Fresh import: Lark "Client management.csv" → VF ERP Supabase
 * Based on Client Management Structure directive (13 fields).
 *
 * Run: node execution/scripts/import-clients.mjs
 * WARNING: Deletes all existing clients, contacts, and upsell_opportunities before import.
 */

import { createReadStream } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

const CSV_PATH = "/Users/williamsudhana/VF ERP System/Data/Client management.csv"

// ─── Customer Code — 4-letter abbreviation ───────────────────────────────────
// Rule from directive: PT. Astra International Tbk → ASTI
//   Strip: PT, CV, Tbk, The, &, and, of, for + punctuation
//   1 word          → first 4 chars
//   2 sig. words    → first 3 of word1 + first 1 of word2
//   3+ sig. words   → first 2 of word1 + first 2 of last word

const STRIP_WORDS = new Set(["PT", "CV", "TBK", "THE", "AND", "&", "OF", "FOR", "IN", "AT"])

function abbreviate(name) {
  const cleaned = name.toUpperCase().replace(/[.,]/g, " ")
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, ""))
    .filter((w) => w.length > 0 && !STRIP_WORDS.has(w))

  if (words.length === 0) return name.replace(/\s/g, "").slice(0, 4).toUpperCase()

  if (words.length === 1) {
    return words[0].slice(0, 4)
  }

  if (words.length === 2) {
    // first 3 of word1 + first 1 of word2 = 4 chars
    // Edge: if word1 < 3 chars, take all then fill from word2
    const part1 = words[0].slice(0, 3)
    const part2 = words[1].slice(0, 4 - part1.length)
    return (part1 + part2).slice(0, 4)
  }

  // 3+ words: first 2 of word1 + first 2 of last word = 4 chars
  const part1 = words[0].slice(0, 2)
  const part2 = words[words.length - 1].slice(0, 2)
  return (part1 + part2).slice(0, 4)
}

function resolveCode(name, usedCodes) {
  const base = abbreviate(name)
  if (!usedCodes.has(base)) {
    usedCodes.add(base)
    return base
  }
  let i = 2
  while (usedCodes.has(base + i)) i++
  const code = base + i
  usedCodes.add(code)
  return code
}

// ─── Industry normalization ───────────────────────────────────────────────────
// Directive dropdown: Retail FMCG, Internet & Technology, Fashion & Beauty,
// Finance, Health & Medical, E-Commerce, Service, FnB Horeca, Government,
// Automotive, Property, SAAS

const INDUSTRY_MAP = {
  "retail fmcg": "Retail FMCG",
  "internet & technology": "Internet & Technology",
  "internet and technology": "Internet & Technology",
  "technology": "Internet & Technology",
  "fashion & beauty": "Fashion & Beauty",
  "fashion and beauty": "Fashion & Beauty",
  "fashion": "Fashion & Beauty",
  "beauty": "Fashion & Beauty",
  "finance": "Finance",
  "financial": "Finance",
  "banking": "Finance",
  "health & medical": "Health & Medical",
  "health and medical": "Health & Medical",
  "health": "Health & Medical",
  "medical": "Health & Medical",
  "healthcare": "Health & Medical",
  "e-commerce": "E-Commerce",
  "ecommerce": "E-Commerce",
  "e commerce": "E-Commerce",
  "service": "Service",
  "services": "Service",
  "fnb horeca": "FnB Horeca",
  "fnb": "FnB Horeca",
  "food & beverage": "FnB Horeca",
  "food and beverage": "FnB Horeca",
  "restaurant": "FnB Horeca",
  "government": "Government",
  "automotive": "Automotive",
  "property": "Property",
  "real estate": "Property",
  "saas": "SAAS",
  "software": "SAAS",
}

function normalizeIndustry(raw) {
  if (!raw || !raw.trim()) return null
  const key = raw.trim().toLowerCase()
  return INDUSTRY_MAP[key] ?? raw.trim()
}

// ─── Org size normalization ───────────────────────────────────────────────────
// Directive: 1-10, 11-50, 51-200, 201-1000, 1000+
// CSV:       <10,  10-100, 100-1,000, 1,000-10,000

function normalizeOrgSize(raw) {
  if (!raw || !raw.trim()) return null
  const clean = raw.trim().replace(/,/g, "")
  if (clean === "<10" || clean === "1-10") return "1-10"
  if (clean === "10-100") return "11-50"
  if (clean === "100-1000") return "51-200"
  if (clean === "1000-10000" || clean === "1,000-10,000") return "201-1000"
  // Pass through if already in directive format
  if (["1-10", "11-50", "51-200", "201-1000", "1000+"].includes(clean)) return clean
  return raw.trim()
}

// ─── Client Status from Stage ─────────────────────────────────────────────────
function deriveClientStatus(stage) {
  if (!stage) return "lead"
  if (stage.includes("Order won") || stage.includes("🎉")) return "active"
  if (stage.includes("Possible opportunity") || stage.includes("🚩")) return "lead"
  if (stage.includes("No opportunity") || stage.includes("❕")) return "inactive"
  return "lead"
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseIDR(str) {
  if (!str || !str.trim() || str.trim() === "Rp0") return null
  const clean = str.replace(/Rp/gi, "").replace(/,/g, "").trim()
  const num = parseFloat(clean)
  return isNaN(num) || num === 0 ? null : num
}

function nameToEmail(name) {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "") + "@vosfoyerid.com"
  )
}

function parseOpportunities(raw) {
  if (!raw || !raw.trim()) return []
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split("-").map((p) => p.trim())
      if (parts.length < 2) return null
      const rest = parts.slice(1)
      const last = rest[rest.length - 1]
      const relevant = /^\d{2}$/.test(last) ? rest.slice(0, -1) : rest
      const service = relevant.filter((s) => s.length > 0).join(" — ")
      return service.length > 0 ? service : null
    })
    .filter(Boolean)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not found in .env")

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  console.log("📂 Reading CSV:", CSV_PATH)
  const rows = await new Promise((resolve, reject) => {
    const records = []
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true, bom: true }))
      .on("data", (r) => records.push(r))
      .on("end", () => resolve(records))
      .on("error", reject)
  })
  console.log(`📊 ${rows.length} rows parsed`)

  // ── Wipe existing data ───────────────────────────────────────────────────
  console.log("\n🗑️  Clearing existing clients, contacts, upsell opportunities...")
  await prisma.upsellOpportunity.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.client.deleteMany()
  console.log("   Done.")

  // ── Upsert AE users ──────────────────────────────────────────────────────
  const aeNames = [...new Set(rows.map((r) => r["Sales"]?.trim()).filter(Boolean))]
  console.log(`\n👥 Upserting ${aeNames.length} AEs...`)
  const aeMap = {}
  for (const name of aeNames) {
    const email = nameToEmail(name)
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, role: "account" },
    })
    aeMap[name] = user.id
    console.log(`   ${name} → ${email}`)
  }

  // ── Import rows ──────────────────────────────────────────────────────────
  console.log("\n🔄 Importing clients...")
  const usedCodes = new Set()
  let clientsCreated = 0
  let contactsCreated = 0
  let upsellsCreated = 0

  for (const row of rows) {
    const clientName = row["Client"]?.trim()
    if (!clientName) continue

    const customerCode = resolveCode(clientName, usedCodes)
    const industry = normalizeIndustry(row["Industry"])
    const orgSize = normalizeOrgSize(row["Org size"])
    const annualValue = parseIDR(row["Cumulative value of orders"])
    const aeName = row["Sales"]?.trim()
    const primaryAe = aeName ? (aeMap[aeName] ?? null) : null

    const notesParts = [row["Focus Product Offer"]?.trim(), row["Client's Response"]?.trim()].filter(Boolean)
    const notes = notesParts.length > 0 ? notesParts.join("\n\n") : null

    const client = await prisma.client.create({
      data: {
        name: clientName,
        industry,
        orgSize,
        customerCode,
        engagementType: "project",
        healthStatus: "healthy",
        primaryAe,
        annualValue,
        notes,
      },
    })
    clientsCreated++

    // Contact
    const contactName = row["Contact"]?.trim()
    if (contactName) {
      await prisma.contact.create({
        data: {
          clientId: client.id,
          name: contactName,
          role: row["Position of the contact"]?.trim() || null,
          email: row["Email"]?.trim() || null,
          phone: row["Phone number"]?.trim() || null,
          isPrimary: true,
        },
      })
      contactsCreated++
    }

    // Upsell opportunities
    for (const service of parseOpportunities(row["Business opportunity"])) {
      await prisma.upsellOpportunity.create({
        data: { clientId: client.id, service, status: "identified" },
      })
      upsellsCreated++
    }
  }

  await prisma.$disconnect()

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n✅ Import complete!")
  console.log(`   Clients created:  ${clientsCreated}`)
  console.log(`   Contacts created: ${contactsCreated}`)
  console.log(`   Upsells created:  ${upsellsCreated}`)
  console.log(`   Client Status: null (will be derived from Project tab in Phase 2)`)
}

main().catch((err) => {
  console.error("❌ Import failed:", err.message)
  process.exit(1)
})
