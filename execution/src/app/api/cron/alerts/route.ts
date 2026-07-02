import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createNotification, createNotifications } from "@/lib/notifications"
import { recalcNextActivity } from "@/lib/activities"

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

  const in60 = new Date(today)
  in60.setDate(in60.getDate() + 60)

  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // ── T-60 renewal alerts ────────────────────────────────────────────────────
  // Active clients whose contractEnd is within the next 60 days (and not already past)

  const t60Clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      clientStatus: { not: "inactive" },
      contractEnd: { gte: today, lte: in60 },
    },
    select: {
      id: true,
      name: true,
      primaryAe: true,
      contractEnd: true,
    },
  })

  let t60Created = 0
  let t60Existing = 0

  // Find admin fallback for activity assignment when no AE
  const adminUser = await prisma.user.findFirst({
    where: { role: "admin", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  for (const client of t60Clients) {
    const contractEndDate = client.contractEnd!
    const dedupeKey = `renewal_t60:${client.id}:${contractEndDate.toISOString().split("T")[0]}`

    const existing = await prisma.alert.findUnique({ where: { dedupeKey } })

    if (existing) {
      t60Existing++
      continue
    }

    t60Created++
    if (dryRun) continue

    // Due date for the auto-created activity: contractEnd - 45 days, or tomorrow if already past
    const activityDueRaw = new Date(contractEndDate)
    activityDueRaw.setDate(activityDueRaw.getDate() - 45)
    const activityDue = activityDueRaw < tomorrow ? tomorrow : activityDueRaw

    const assigneeId = client.primaryAe ?? adminUser?.id
    if (!assigneeId) continue // no one to assign to — skip silently

    await prisma.$transaction(async (tx) => {
      // Create the Alert
      const alert = await tx.alert.create({
        data: {
          type: "renewal_t60",
          clientId: client.id,
          assignedTo: assigneeId,
          dedupeKey,
        },
      })

      // Auto-create an Activity for the AE
      const activity = await tx.activity.create({
        data: {
          type: "todo",
          subject: `Mulai percakapan renewal — ${client.name}`,
          dueDate: activityDue,
          assignedTo: assigneeId,
          createdBy: assigneeId,
          clientId: client.id,
          note: `Kontrak berakhir ${contractEndDate.toISOString().split("T")[0]}. Alert ID: ${alert.id}`,
        },
      })

      // Recalc nextActivityAt for any leads under this client
      const clientLeads = await tx.lead.findMany({
        where: { clientId: client.id, deletedAt: null },
        select: { id: true },
      })
      for (const lead of clientLeads) {
        await recalcNextActivity(lead.id, tx)
      }

      // Notify the AE
      await createNotification(
        {
          userId: assigneeId,
          type: "alert",
          title: `Renewal T-60: ${client.name}`,
          body: `Kontrak ${client.name} berakhir dalam 60 hari (${contractEndDate.toISOString().split("T")[0]}). Activity telah dibuat.`,
          entityType: "client",
          entityId: client.id,
        },
        tx
      )

      return activity
    })
  }

  // ── T-30 escalation alerts ─────────────────────────────────────────────────
  // Client contractEnd within 30 days AND no open contract_renewal lead

  const t30Clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      clientStatus: { not: "inactive" },
      contractEnd: { gte: today, lte: in30 },
    },
    select: { id: true, name: true, contractEnd: true },
  })

  let t30Created = 0
  let t30Existing = 0

  // Find commercial directors and admins for escalation notifications
  const escalatees = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["commercial_director", "admin"] },
    },
    select: { id: true },
  })

  for (const client of t30Clients) {
    const contractEndDate = client.contractEnd!
    const dedupeKey = `renewal_t30:${client.id}:${contractEndDate.toISOString().split("T")[0]}`

    const existing = await prisma.alert.findUnique({ where: { dedupeKey } })
    if (existing) {
      t30Existing++
      continue
    }

    // Check: is there an open contract_renewal lead or a renewedFrom lead for this client?
    const hasRenewalActivity = await prisma.lead.findFirst({
      where: {
        clientId: client.id,
        deletedAt: null,
        OR: [
          { stage: "contract_renewal" },
          {
            renewedFromLeadId: { not: null },
            stage: { notIn: ["lost_deal", "no_response"] },
          },
        ],
      },
      select: { id: true },
    })

    if (hasRenewalActivity) {
      t30Existing++ // renewal already in motion — no escalation needed
      continue
    }

    t30Created++
    if (dryRun) continue

    await prisma.$transaction(async (tx) => {
      await tx.alert.create({
        data: {
          type: "renewal_t30",
          clientId: client.id,
          dedupeKey,
        },
      })

      if (escalatees.length > 0) {
        await createNotifications(
          escalatees.map((u) => ({
            userId: u.id,
            type: "alert" as const,
            title: `ESKALASI Renewal T-30: ${client.name}`,
            body: `Kontrak ${client.name} berakhir dalam 30 hari (${contractEndDate.toISOString().split("T")[0]}) dan belum ada lead renewal aktif.`,
            entityType: "client",
            entityId: client.id,
          })),
          undefined,
          tx
        )
      }
    })
  }

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
      t60_renewal: { created: t60Created, alreadyExisted: t60Existing },
      t30_escalation: { created: t30Created, alreadyExisted: t30Existing },
      activity_overdue: { notified: overdueNotified, skipped: overdueSkipped },
    },
  })
}
