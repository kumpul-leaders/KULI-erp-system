import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── GET /api/notifications ───────────────────────────────────────────────────
// Returns notifications for the authenticated user, sorted by createdAt desc.
//
// Query params:
//   unread=1   → filter to unread only (readAt IS NULL)
//   limit=N    → max results (default 20, max 100)
//
// Response: { notifications: Notification[], unreadCount: number }

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "1"
  const limitParam = parseInt(searchParams.get("limit") ?? "20", 10)
  const limit = Math.min(isNaN(limitParam) || limitParam < 1 ? 20 : limitParam, 100)

  try {
    const where: Record<string, unknown> = { userId: user.id }
    if (unreadOnly) where.readAt = null

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ])

    return NextResponse.json({
      notifications: notifications.map(serializeNotification),
      unreadCount,
    })
  } catch (err) {
    console.error("[GET /api/notifications]", err)
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
