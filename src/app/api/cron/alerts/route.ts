import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"

// Vercel serverless: allow up to 60 seconds for this route
export const maxDuration = 60

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyCronAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET env variable is not configured on this server" },
      { status: 500 }
    )
  }
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

// ── GET /api/cron/alerts ──────────────────────────────────────────────────────
// Scheduled: 0 2 * * * (daily 02:00 UTC via Vercel Cron)
// Auth: Authorization: Bearer ${CRON_SECRET}
// Query: ?dryRun=1  → compute counts only, no writes

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get("dryRun") === "1"

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // ── activity_overdue notifications ─────────────────────────────────────────
  // Open activities with dueDate < today — dedup: max 1 notification per activity per day

  const overdueActivities = await prisma.activity.findMany({
    where: {
      status: "open",
      dueDate: { lt: today },
    },
    select: {
      id: true,
      subject: true,
      assignedTo: true,
      leadId: true,
      clientId: true,
    },
  })

  let overdueNotified = 0
  let overdueSkipped = 0

  const todayStart = new Date(today)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  for (const activity of overdueActivities) {
    // Check if we already notified today for this activity
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        userId: activity.assignedTo,
        type: "activity_overdue",
        entityId: activity.id,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { id: true },
    })

    if (alreadyNotified) {
      overdueSkipped++
      continue
    }

    overdueNotified++
    if (dryRun) continue

    await createNotification({
      userId: activity.assignedTo,
      type: "activity_overdue",
      title: `Activity overdue: ${activity.subject}`,
      body: `Activity ini sudah lewat jatuh tempo. Segera tindak lanjuti atau tandai selesai.`,
      entityType: activity.leadId ? "lead" : "client",
      entityId: activity.leadId ?? activity.clientId ?? undefined,
    })
  }

  return NextResponse.json({
    dryRun,
    summary: {
      activity_overdue: { notified: overdueNotified, skipped: overdueSkipped },
    },
  })
}
