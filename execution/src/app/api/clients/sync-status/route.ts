import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { syncClientStatus } from "@/lib/client-status"

// ── Auth helper ─────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") return null

  return user
}

// ── POST /api/clients/sync-status ───────────────────────────────────────────
// Admin-only backfill: recomputes clientStatus for ALL clients.
// Returns: { updated: number }

export async function POST() {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized — admin only" }, { status: 401 })
  }

  try {
    const clients = await prisma.client.findMany({
      select: { id: true },
    })

    let updated = 0
    for (const c of clients) {
      await syncClientStatus(c.id)
      updated++
    }

    return NextResponse.json({ updated })
  } catch (err) {
    console.error("[POST /api/clients/sync-status]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
