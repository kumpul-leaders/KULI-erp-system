import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { computeHealthSignals, isoWeek, shouldApplyHealthUpdate } from "@/lib/health-score"
import { createNotification } from "@/lib/notifications"
import { recalcNextActivity } from "@/lib/activities"

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

// ── GET /api/cron/health ──────────────────────────────────────────────────────
// Scheduled: 0 3 * * 1 (Monday 03:00 UTC via Vercel Cron)
// Auth: Authorization: Bearer ${CRON_SECRET}
// Query: ?dryRun=1  → compute + report, no writes
//
// QUERY COUNT: constant ≤ 13 reads regardless of client count (was N×9 before).
// All signal data is fetched in bulk then joined in-memory.

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get("dryRun") === "1"

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  // ── Q1: Active clients ────────────────────────────────────────────────────
  const clients = await prisma.client.findMany({
    where: { deletedAt: null, clientStatus: { not: "inactive" } },
    select: { id: true, name: true, primaryAe: true, healthStatus: true },
  })

  if (clients.length === 0) {
    return NextResponse.json({
      dryRun,
      summary: { total: 0, snapshots: 0, healthy: 0, atRisk: 0, skippedColdStart: 0, bandChanges: { improved: 0, worsened: 0, unchanged: 0 } },
    })
  }

  const clientIds = clients.map((c) => c.id)

  // ── Q2: Latest non-canceled activity directly on each client ─────────────
  // Prisma doesn't support groupBy+_max on DateTime, so fetch all and reduce.
  const directActivities = await prisma.activity.findMany({
    where: { clientId: { in: clientIds }, status: { not: "canceled" } },
    select: { clientId: true, updatedAt: true },
  })

  // ── Q3: Latest non-canceled activity on leads belonging to each client ────
  // Need lead.clientId — include via relation select.
  const leadActivities = await prisma.activity.findMany({
    where: {
      lead: { clientId: { in: clientIds }, deletedAt: null },
      status: { not: "canceled" },
    },
    select: {
      updatedAt: true,
      lead: { select: { clientId: true } },
    },
  })

  // ── Q4: Latest non-deleted comment directly on each client ────────────────
  const directComments = await prisma.comment.findMany({
    where: { clientId: { in: clientIds }, deletedAt: null },
    select: { clientId: true, createdAt: true },
  })

  // ── Q5: Latest non-deleted comment on leads belonging to each client ──────
  const leadComments = await prisma.comment.findMany({
    where: {
      lead: { clientId: { in: clientIds }, deletedAt: null },
      deletedAt: null,
    },
    select: {
      createdAt: true,
      lead: { select: { clientId: true } },
    },
  })

  // ── Q6: Won leads in last 6 months per client ─────────────────────────────
  const wonLeadGroups = await prisma.lead.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      deletedAt: null,
      stage: { in: ["closed_won", "invoiced", "contract_renewal"] },
      closedAt: { gte: sixMonthsAgo },
    },
    _count: { _all: true },
  })

  // ── Q7: Open pipeline leads per client ────────────────────────────────────
  const openPipelineGroups = await prisma.lead.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      deletedAt: null,
      stage: { in: ["leads", "pipeline", "negotiation"] },
    },
    _count: { _all: true },
  })

  // ── Q8: Recent upsell won per client ──────────────────────────────────────
  const upsellWonGroups = await prisma.upsellOpportunity.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      status: "won",
      updatedAt: { gte: sixMonthsAgo },
    },
    _count: { _all: true },
  })

  // ── Q9: Open activities per client (direct only — engagement signal) ──────
  const openActivityGroups = await prisma.activity.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      status: "open",
    },
    _count: { _all: true },
  })

  // ── Q10: Open (unacknowledged) alerts per client ──────────────────────────
  const openAlertGroups = await prisma.alert.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      status: "open",
    },
    _count: { _all: true },
  })

  // ── Q11: Previous snapshots (latest per client) ───────────────────────────
  // Fetch all recent snapshots ordered desc, deduplicate per clientId in-memory.
  const allPrevSnapshots = await prisma.clientHealthSnapshot.findMany({
    where: { clientId: { in: clientIds } },
    select: { clientId: true, band: true, computedAt: true },
    orderBy: { computedAt: "desc" },
  })

  // ── Build lookup maps ─────────────────────────────────────────────────────

  // Latest touch timestamp per clientId (ms epoch) — reduce across all 4 sources
  const latestTouchMs = new Map<string, number>()

  function updateTouchMs(clientId: string, ts: Date): void {
    const ms = ts.getTime()
    const cur = latestTouchMs.get(clientId)
    if (cur === undefined || ms > cur) latestTouchMs.set(clientId, ms)
  }

  for (const a of directActivities) {
    if (a.clientId) updateTouchMs(a.clientId, a.updatedAt)
  }
  for (const a of leadActivities) {
    const cid = a.lead?.clientId
    if (cid) updateTouchMs(cid, a.updatedAt)
  }
  for (const c of directComments) {
    if (c.clientId) updateTouchMs(c.clientId, c.createdAt)
  }
  for (const c of leadComments) {
    const cid = c.lead?.clientId
    if (cid) updateTouchMs(cid, c.createdAt)
  }

  const hasWonLeadSet = new Set(wonLeadGroups.map((g) => g.clientId))
  const hasOpenPipelineSet = new Set(openPipelineGroups.map((g) => g.clientId))
  const hasUpsellWonSet = new Set(upsellWonGroups.map((g) => g.clientId))
  const hasOpenActivitySet = new Set(openActivityGroups.map((g) => g.clientId).filter((id): id is string => id !== null))
  const hasOpenAlertSet = new Set(openAlertGroups.map((g) => g.clientId).filter((id): id is string => id !== null))

  // Latest snapshot band per clientId (first seen = most recent due to desc sort)
  const prevBandMap = new Map<string, "healthy" | "at_risk" | "churned">()
  for (const snap of allPrevSnapshots) {
    if (!prevBandMap.has(snap.clientId)) {
      prevBandMap.set(snap.clientId, snap.band)
    }
  }

  // ── Compute per client in-memory ──────────────────────────────────────────

  let healthy = 0
  let atRisk = 0
  let snapshots = 0
  let skippedColdStart = 0
  let improved = 0
  let worsened = 0
  let unchanged = 0

  type SnapshotRow = {
    clientId: string
    score: number
    band: "healthy" | "at_risk" | "churned"
    signalActivity: number
    signalRenewal: number
    signalRevenue: number
    signalEngagement: number
  }

  type BandChangeClient = {
    id: string
    name: string
    primaryAe: string | null
    prevBand: "healthy" | "at_risk" | "churned"
    newBand: "healthy" | "at_risk" | "churned"
    score: number
  }

  const snapshotRows: SnapshotRow[] = []
  const toUpdateHealthy: string[] = []
  const toUpdateAtRisk: string[] = []
  const worsenedClients: BandChangeClient[] = []

  for (const client of clients) {
    const touchMs = latestTouchMs.get(client.id)
    const lastActivityDaysAgo = touchMs !== undefined
      ? Math.floor((today.getTime() - touchMs) / 86400000)
      : null

    const hasEngagementData = touchMs !== undefined

    const result = computeHealthSignals({
      lastActivityDaysAgo,
      contractDaysRemaining: null,
      hasRecentWonLead: hasWonLeadSet.has(client.id),
      hasOpenPipeline: hasOpenPipelineSet.has(client.id),
      hasRecentUpsellWon: hasUpsellWonSet.has(client.id),
      hasOpenActivity: hasOpenActivitySet.has(client.id),
      hasUnacknowledgedAlert: hasOpenAlertSet.has(client.id),
    })

    if (result.band === "healthy") healthy++
    else atRisk++
    snapshots++

    snapshotRows.push({
      clientId: client.id,
      score: result.score,
      band: result.band,
      signalActivity: result.signalActivity,
      signalRenewal: result.signalRenewal,
      signalRevenue: result.signalRevenue,
      signalEngagement: result.signalEngagement,
    })

    // Cold-start guard — skip healthStatus + alerts for clients with no engagement data
    if (!shouldApplyHealthUpdate(hasEngagementData)) {
      skippedColdStart++
      continue
    }

    const prevBand = prevBandMap.get(client.id) ?? null
    const bandChanged = prevBand !== null && result.band !== prevBand

    // "churned" is never auto-set — only queue healthy/at_risk updates
    if (bandChanged && result.band !== "churned") {
      if (result.band === "healthy") {
        toUpdateHealthy.push(client.id)
        improved++
      } else {
        toUpdateAtRisk.push(client.id)
        worsened++
        worsenedClients.push({
          id: client.id,
          name: client.name,
          primaryAe: client.primaryAe,
          prevBand: prevBand as "healthy" | "at_risk" | "churned",
          newBand: result.band,
          score: result.score,
        })
      }
    } else if (!bandChanged) {
      unchanged++
    }
  }

  // ── dryRun: skip all writes ───────────────────────────────────────────────
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
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

  // ── Batch writes ──────────────────────────────────────────────────────────

  // W1: Insert all snapshots in one shot
  await prisma.clientHealthSnapshot.createMany({ data: snapshotRows })

  // W2: Batch healthStatus update — at_risk group
  if (toUpdateAtRisk.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: toUpdateAtRisk } },
      data: { healthStatus: "at_risk" },
    })
  }

  // W3: Batch healthStatus update — healthy group
  if (toUpdateHealthy.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: toUpdateHealthy } },
      data: { healthStatus: "healthy" },
    })
  }

  // W4+: Per-worsened-client: alert + activity + notification (rare path)
  // These are individual per client because each needs its own dedupeKey,
  // assignee, and notification target. In steady state this list is small.
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const week = isoWeek(today)

  for (const wc of worsenedClients) {
    const dedupeKey = `health_drop:${wc.id}:${wc.newBand}:${week}`

    const existingAlert = await prisma.alert.findUnique({ where: { dedupeKey } })
    if (existingAlert) continue

    const assigneeId = wc.primaryAe ?? null

    await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          type: "health_drop",
          clientId: wc.id,
          assignedTo: assigneeId ?? undefined,
          dedupeKey,
        },
      })

      if (assigneeId) {
        await tx.activity.create({
          data: {
            type: "todo",
            subject: `Health drop: follow-up ${wc.name}`,
            dueDate: tomorrow,
            assignedTo: assigneeId,
            createdBy: assigneeId,
            clientId: wc.id,
            note: `Health score turun ke ${wc.score} (${wc.newBand}). Alert ID: ${alert.id}`,
          },
        })

        const clientLeads = await tx.lead.findMany({
          where: { clientId: wc.id, deletedAt: null },
          select: { id: true },
        })
        for (const lead of clientLeads) {
          await recalcNextActivity(lead.id, tx)
        }

        await createNotification(
          {
            userId: assigneeId,
            type: "alert",
            title: `Health drop: ${wc.name}`,
            body: `Score ${wc.name} turun ke ${wc.score} (${wc.newBand}). Activity check-in sudah dibuat.`,
            entityType: "client",
            entityId: wc.id,
          },
          tx
        )
      }
    })
  }

  return NextResponse.json({
    dryRun: false,
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
