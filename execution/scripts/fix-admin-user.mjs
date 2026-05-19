#!/usr/bin/env node
/**
 * One-shot script: ensure william.sudhana@gmail.com has role "admin" in DB.
 * Run: node scripts/fix-admin-user.mjs
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })
config({ path: resolve(__dirname, "../.env.local"), override: true })

// Use DIRECT_URL (port 5432) for schema operations
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = "william.sudhana@gmail.com"
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    if (existing.role === "admin") {
      console.log(`✓ ${email} already admin (id: ${existing.id})`)
    } else {
      await prisma.user.update({ where: { email }, data: { role: "admin", isActive: true } })
      console.log(`✓ Updated ${email} role: ${existing.role} → admin`)
    }
  } else {
    const created = await prisma.user.create({
      data: { name: "William Sudhana", email, role: "admin", isActive: true },
    })
    console.log(`✓ Created admin user: ${email} (id: ${created.id})`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
