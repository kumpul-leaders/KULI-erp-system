import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import { z } from "zod"

// ── Schema ───────────────────────────────────────────────────────────────────

const AlertActionSchema = z.object({
  action: z.enum(["acknowledge", "resolve"]),
})

// ── PATCH /api/alerts/[id] ───────────────────────────────────────────────────
// Body: { action: "acknowledge" | "resolve" }
// All authenticated users can acknowledge/resolve alerts they are assigned to.
// Admin and commercial_director can action any alert.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = AlertActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'acknowledge' or 'resolve'" },
      { status: 400 }
    )
  }

  const { action } = parsed.data

  try {
    const alert = await prisma.alert.findUnique({ where: { id } })
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }

    // Authorization: admin/director can act on any alert; others only their assigned alerts
    const isAdminOrDirector =
      user.role === "admin" || user.role === "commercial_director"
    if (!isAdminOrDirector && alert.assignedTo !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const newStatus = action === "acknowledge" ? "acknowledged" : "resolved"
    const updated = await prisma.alert.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedAt: action === "resolve" ? new Date() : alert.resolvedAt,
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, description: true } },
        assignee: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      alert: {
        id: updated.id,
        type: updated.type,
        status: updated.status,
        dedupeKey: updated.dedupeKey,
        triggeredAt: updated.triggeredAt.toISOString(),
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        client: updated.client
          ? { id: updated.client.id, name: updated.client.name }
          : null,
        lead: updated.lead
          ? { id: updated.lead.id, description: updated.lead.description }
          : null,
        assignee: updated.assignee
          ? { id: updated.assignee.id, name: updated.assignee.name }
          : null,
      },
    })
  } catch (err) {
    console.error("[PATCH /api/alerts/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
