#!/usr/bin/env node
/**
 * Set isActive=false for a user by email so they can be re-invited.
 * Run: node scripts/reset-user.mjs email@example.com
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

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error("Usage: node scripts/reset-user.mjs email@example.com")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`✗ User not found: ${email}`)
    process.exit(1)
  }

  await prisma.user.update({ where: { email }, data: { isActive: false } })
  console.log(`✓ Reset ${email} → isActive: false. Now re-add from the app.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
