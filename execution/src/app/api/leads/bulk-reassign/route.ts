import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-role"

// ── POST /api/leads/bulk-reassign ────────────────────────────────────────────
// Admin only. Atomically moves all leads and clients from one user to another.
//
// Body: { fromUserId: string, toUserId: string }
// Response: { leadsReassigned: number, clientsReassigned: number }

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { fromUserId, toUserId } = body

  if (!fromUserId || typeof fromUserId !== "string") {
    return NextResponse.json({ error: "fromUserId is required" }, { status: 400 })
  }
  if (!toUserId || typeof toUserId !== "string") {
    return NextResponse.json({ error: "toUserId is required" }, { status: 400 })
  }
  if (fromUserId === toUserId) {
    return NextResponse.json(
      { error: "fromUserId and toUserId must be different" },
      { status: 400 }
    )
  }

  // Validate both users exist
  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, isActive: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, isActive: true } }),
  ])

  if (!fromUser) {
    return NextResponse.json({ error: "fromUserId not found" }, { status: 404 })
  }
  if (!toUser) {
    return NextResponse.json({ error: "toUserId not found" }, { status: 404 })
  }
  if (!toUser.isActive) {
    return NextResponse.json(
      { error: "toUserId must be an active user" },
      { status: 400 }
    )
  }

  try {
    // Atomic transaction: reassign leads and clients in one operation
    const [leadsResult, clientsResult] = await prisma.$transaction([
      prisma.lead.updateMany({
        where: { salesId: fromUserId },
        data: { salesId: toUserId },
      }),
      prisma.client.updateMany({
        where: { primaryAe: fromUserId },
        data: { primaryAe: toUserId },
      }),
    ])

    return NextResponse.json({
      leadsReassigned: leadsResult.count,
      clientsReassigned: clientsResult.count,
    })
  } catch (err) {
    console.error("[POST /api/leads/bulk-reassign]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
