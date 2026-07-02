import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeHealthSignals, isoWeek, shouldApplyHealthUpdate } from "@/lib/health-score"
import { createNotification } from "@/lib/notifications"
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

// ── GET /api/cron/health ──────────────────────────────────────────────────────
// Scheduled: 0 3 * * 1 (Monday 03:00 UTC via Vercel Cron)
// Auth: Authorization: Bearer ${CRON_SECRET}
// Query: ?dryRun=1  → compute signals only, no writes

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get("dryRun") === "1"

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // 6 months ago for "recent won lead" check
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // Active clients only
  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      clientStatus: { not: "inactive" },
    },
    select: {
      id: true,
      name: true,
      primaryAe: true,
      contractEnd: true,
      healthStatus: true,
    },
  })

  let healthy = 0
  let atRisk = 0
  let improved = 0
  let worsened = 0
  let unchanged = 0
  let snapshots = 0
  let skippedColdStart = 0

  for (const client of clients) {
    // ── Gather signal data ────────────────────────────────────────────────────

    // Last activity/comment on client or its leads
    const [lastClientActivity, lastLeadActivity, lastClientComment, lastLeadComment] =
      await Promise.all([
        prisma.activity.findFirst({
          where: { clientId: client.id, status: { not: "canceled" } },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.activity.findFirst({
          where: {
            lead: { clientId: client.id, deletedAt: null },
            status: { not: "canceled" },
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.comment.findFirst({
          where: { clientId: client.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.comment.findFirst({
          where: {
            lead: { clientId: client.id, deletedAt: null },
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ])

    // Most recent touch across all 4 sources
    const dates = [
      lastClientActivity?.updatedAt,
      lastLeadActivity?.updatedAt,
      lastClientComment?.createdAt,
      lastLeadComment?.createdAt,
    ].filter((d): d is Date => d !== undefined && d !== null)

    const latestTouch = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null
    const lastActivityDaysAgo = latestTouch
      ? Math.floor((today.getTime() - latestTouch.getTime()) / 86400000)
      : null

    // ── Cold-start guard ──────────────────────────────────────────────────────
    // A client has engagement data when at least one Activity or Comment has
    // ever been recorded for it (any date). Without this data, signalActivity=0
    // for every client on first run, which would flip all healthStatus to at_risk
    // and spam health_drop alerts — a cold-start artifact, not a real signal.
    //
    // Rule: snapshots are always saved (data collection runs from day 1).
    // healthStatus updates and health_drop alerts only fire once the team has
    // started using the system for that client (≥1 activity or comment, ever).
    const hasEngagementData = dates.length > 0

    // Contract days remaining
    const contractDaysRemaining = client.contractEnd
      ? Math.floor((client.contractEnd.getTime() - today.getTime()) / 86400000)
      : null

    // Revenue signals
    const [recentWonLead, openPipelineLead, recentUpsellWon] = await Promise.all([
      prisma.lead.findFirst({
        where: {
          clientId: client.id,
          deletedAt: null,
          stage: { in: ["closed_won", "invoiced", "contract_renewal"] },
          closedAt: { gte: sixMonthsAgo },
        },
        select: { id: true },
      }),
      prisma.lead.findFirst({
        where: {
          clientId: client.id,
          deletedAt: null,
          stage: { in: ["leads", "pipeline", "negotiation"] },
        },
        select: { id: true },
      }),
      prisma.upsellOpportunity.findFirst({
        where: {
          clientId: client.id,
          status: "won",
          updatedAt: { gte: sixMonthsAgo },
        },
        select: { id: true },
      }),
    ])

    // Engagement signals
    const [openActivity, unacknowledgedAlert] = await Promise.all([
      prisma.activity.findFirst({
        where: { clientId: client.id, status: "open" },
        select: { id: true },
      }),
      prisma.alert.findFirst({
        where: { clientId: client.id, status: "open" },
        select: { id: true },
      }),
    ])

    // ── Compute health ────────────────────────────────────────────────────────

    const result = computeHealthSignals({
      lastActivityDaysAgo,
      contractDaysRemaining,
      hasRecentWonLead: !!recentWonLead,
      hasOpenPipeline: !!openPipelineLead,
      hasRecentUpsellWon: !!recentUpsellWon,
      hasOpenActivity: !!openActivity,
      hasUnacknowledgedAlert: !!unacknowledgedAlert,
    })

    if (result.band === "healthy") healthy++
    else atRisk++
    snapshots++

    if (dryRun) continue

    // Get the most recent snapshot to detect band change
    const prevSnapshot = await prisma.clientHealthSnapshot.findFirst({
      where: { clientId: client.id },
      orderBy: { computedAt: "desc" },
      select: { band: true },
    })

    const prevBand = prevSnapshot?.band ?? null
    const bandChanged = prevBand !== null && result.band !== prevBand

    // Always save snapshot — data collection is unconditional
    await prisma.clientHealthSnapshot.create({
      data: {
        clientId: client.id,
        score: result.score,
        band: result.band,
        signalActivity: result.signalActivity,
        signalRenewal: result.signalRenewal,
        signalRevenue: result.signalRevenue,
        signalEngagement: result.signalEngagement,
      },
    })

    // Cold-start guard: skip healthStatus update and alert creation if the team
    // has never logged an activity or comment for this client yet.
    if (!shouldApplyHealthUpdate(hasEngagementData)) {
      skippedColdStart++
      continue
    }

    // Update Client.healthStatus only if band changed
    // "churned" is never auto-set — that's a manual decision
    if (bandChanged && result.band !== "churned") {
      await prisma.client.update({
        where: { id: client.id },
        data: { healthStatus: result.band },
      })

      const banddiff =
        prevBand === "healthy" && result.band === "at_risk" ? "memburuk" : "membaik"

      if (banddiff === "memburuk") {
        worsened++

        // Alert + Activity for worsened health
        const week = isoWeek(today)
        const dedupeKey = `health_drop:${client.id}:${result.band}:${week}`

        const existingAlert = await prisma.alert.findUnique({ where: { dedupeKey } })
        if (!existingAlert) {
          const assigneeId = client.primaryAe ?? null

          await prisma.$transaction(async (tx) => {
            const alert = await tx.alert.create({
              data: {
                type: "health_drop",
                clientId: client.id,
                assignedTo: assigneeId ?? undefined,
                dedupeKey,
              },
            })

            if (assigneeId) {
              // Auto-create check-in activity for the AE
              const tomorrow = new Date(today)
              tomorrow.setDate(tomorrow.getDate() + 1)

              await tx.activity.create({
                data: {
                  type: "todo",
                  subject: `Health drop: follow-up ${client.name}`,
                  dueDate: tomorrow,
                  assignedTo: assigneeId,
                  createdBy: assigneeId,
                  clientId: client.id,
                  note: `Health score turun ke ${result.score} (${result.band}). Alert ID: ${alert.id}`,
                },
              })

              // Recalc nextActivityAt for active leads
              const clientLeads = await tx.lead.findMany({
                where: { clientId: client.id, deletedAt: null },
                select: { id: true },
              })
              for (const lead of clientLeads) {
                await recalcNextActivity(lead.id, tx)
              }

              await createNotification(
                {
                  userId: assigneeId,
                  type: "alert",
                  title: `Health drop: ${client.name}`,
                  body: `Score ${client.name} turun ke ${result.score} (${result.band}). Activity check-in sudah dibuat.`,
                  entityType: "client",
                  entityId: client.id,
                },
                tx
              )
            }
          })
        }
      } else {
        improved++
      }
    } else if (!bandChanged) {
      unchanged++
    }
  }

  return NextResponse.json({
    dryRun,
    summary: {
      total: clients.length,
      snapshots,
      healthy,
      atRisk,
      skippedColdStart,
      bandChanges: { improved, worsened, unchanged },
    },
  })
}
