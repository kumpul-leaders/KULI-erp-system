import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { BulkReassignSchema } from "@/lib/validations/lead"
import { createNotification } from "@/lib/notifications"

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

  const parsed = await parseBody(BulkReassignSchema, request)
  if (parsed.error) return parsed.error

  const { fromUserId, toUserId } = parsed.data

  if (fromUserId === toUserId) {
    return NextResponse.json(
      { error: "fromUserId and toUserId must be different" },
      { status: 400 }
    )
  }

  // Validate both users exist
  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true, isActive: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true, isActive: true } }),
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

    // lead_assigned: notify toUser once for the bulk reassignment
    // Anti-noise: skip if admin is reassigning to themselves
    if (leadsResult.count > 0 && toUserId !== admin.id) {
      await createNotification({
        userId: toUserId,
        type: "lead_assigned",
        title: `Lu di-assign ${leadsResult.count} lead${leadsResult.count > 1 ? "s" : ""} dari ${fromUser.name ?? "pengguna lain"}`,
        entityType: "lead",
        actorId: admin.id,
      })
    }

    return NextResponse.json({
      leadsReassigned: leadsResult.count,
      clientsReassigned: clientsResult.count,
    })
  } catch (err) {
    console.error("[POST /api/leads/bulk-reassign]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
