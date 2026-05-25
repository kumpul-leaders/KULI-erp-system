import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── GET /api/system-config ───────────────────────────────────────────────────
// Returns all system config keys as a flat object { [key]: value }.
// Accessible to any authenticated user.

export async function GET() {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const rows = await prisma.systemConfig.findMany()
    const config = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    return NextResponse.json({ config })
  } catch (err) {
    console.error("[GET /api/system-config]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
