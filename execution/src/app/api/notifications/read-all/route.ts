import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── POST /api/notifications/read-all ────────────────────────────────────────
// Marks all unread notifications for the authenticated user as read.
//
// Body: (none required)
// Response: { markedRead: number }

export async function POST() {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })

    return NextResponse.json({ markedRead: result.count })
  } catch (err) {
    console.error("[POST /api/notifications/read-all]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
