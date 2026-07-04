import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── PATCH /api/notifications/[id] ───────────────────────────────────────────
// Marks a single notification as read. Owner only.
//
// Body: { action: "read" }
// Response: { notification: Notification }

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

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>).action !== "read"
  ) {
    return NextResponse.json(
      { error: 'body must be { action: "read" }' },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.notification.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Idempotent — if already read, return as-is without an extra write
    if (existing.readAt !== null) {
      return NextResponse.json({ notification: serializeNotification(existing) })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })

    return NextResponse.json({ notification: serializeNotification(updated) })
  } catch (err) {
    console.error("[PATCH /api/notifications/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── Serializer ───────────────────────────────────────────────────────────────

function serializeNotification(n: {
  id: string
  userId: string
  type: string
  title: string
  body: string | null
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
}) {
  return {
    ...n,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }
}
