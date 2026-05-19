import { defineConfig } from "prisma/config"
import * as dotenv from "dotenv"
import * as path from "path"

// Load .env explicitly — Prisma 7 defineConfig does not auto-load .env files
dotenv.config({ path: path.resolve(__dirname, ".env") })

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Use DIRECT_URL (port 5432) — Prisma 7 schema engine does not forward directUrl
    // to the migration engine, so using the pooler (6543) causes db push to hang.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
})
