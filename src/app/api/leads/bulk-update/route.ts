import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { BulkUpdateLeadSchema } from "@/lib/validations/lead"

// ── POST /api/leads/bulk-update ──────────────────────────────────────────────
// Reassign selected leads to a different AE.
//
// Body: { leadIds: string[], salesId: string | null }
// Response: { updated: number }

export async function POST(request: NextRequest) {
  const user = await requireCanCreateLeads()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = await parseBody(BulkUpdateLeadSchema, request)
  if (parsed.error) return parsed.error

  const { leadIds, salesId } = parsed.data

  try {
    const result = await prisma.lead.updateMany({
      where: { id: { in: leadIds }, deletedAt: null },
      data: { salesId: salesId ?? null },
    })

    return NextResponse.json({ updated: result.count })
  } catch (err) {
    console.error("[POST /api/leads/bulk-update]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
