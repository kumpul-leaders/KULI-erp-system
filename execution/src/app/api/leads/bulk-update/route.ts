import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"

// ── POST /api/leads/bulk-update ──────────────────────────────────────────────
// Reassign selected leads to a different AE.
//
// Body: { leadIds: string[], salesId: string | null }
// Response: { updated: number }

export async function POST(request: NextRequest) {
  const user = await requireCanCreateLeads()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { leadIds, salesId } = body

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json(
      { error: "leadIds must be a non-empty array" },
      { status: 400 }
    )
  }

  if (typeof salesId !== "string" && salesId !== null) {
    return NextResponse.json(
      { error: "salesId must be a string or null" },
      { status: 400 }
    )
  }

  try {
    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds as string[] } },
      data: { salesId: salesId ?? null },
    })

    return NextResponse.json({ updated: result.count })
  } catch (err) {
    console.error("[POST /api/leads/bulk-update]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
