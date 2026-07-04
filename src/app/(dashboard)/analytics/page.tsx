import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { AnalyticsContent } from "@/components/analytics/analytics-content"
import { $Enums } from "@prisma/client"

export const metadata: Metadata = {
  title: "Analytics",
}

// ---------------------------------------------------------------------------
// Serialized output types — no Decimal, no Date
// ---------------------------------------------------------------------------

export type WinRateByAE = {
  aeId: string
  aeName: string
  total: number
  won: number
  lost: number
  winRate: number
  revenue: number
}

export type WinRateByIndustry = {
  industry: string
  total: number
  won: number
  winRate: number
}

export type RevenueTrendPoint = {
  month: string      // "Jan 26", "Feb 26", etc.
  won: number        // SUM actualRevenue: stage IN [closed_won, invoiced]
  active: number     // SUM projectedRevenue: stage IN [pipeline, negotiation, contract_renewal]
  potential: number  // SUM projectedRevenue: stage = leads
}

export type FunnelStage = {
  stage: string       // raw key
  label: string       // human-readable
  count: number
  conversionRate: number | null  // null for first stage, % from previous stage
  revenue: number     // total projected + actual revenue in this stage
}

export type ClientRetention = {
  renewed: number
  upsellWon: number
  total: number
  rate: number
}

export type OverallWinRate = {
  lost: number
  denominator: number
  winLossRate: number
}

export type AEUser = {
  id: string
  name: string
}

export type RevenueByProductLine = {
  productLine: string
  revenue: number
}

export type PipelineValueStat = {
  total: number
}

export type LostReasonDist = {
  reason: string   // human-readable Indonesian label, "(belum dikategorikan)" for null
  count: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WON_STAGES: $Enums.PipelineStage[] = [
  $Enums.PipelineStage.closed_won,
  $Enums.PipelineStage.invoiced,
  $Enums.PipelineStage.contract_renewal,
]

const LOST_STAGES: $Enums.PipelineStage[] = [
  $Enums.PipelineStage.lost_deal,
]

const FUNNEL_ORDER: Array<{ key: string; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "pipeline", label: "Pipeline" },
  { key: "negotiation", label: "Negotiation" },
  { key: "closed_won", label: "Closed Won" },
  { key: "invoiced", label: "Invoiced" },
  { key: "contract_renewal", label: "Contract Renewal" },
  { key: "lost_deal", label: "Lost Deal" },
  { key: "no_response", label: "No Response" },
]

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/**
 * Given raw searchParams from Next.js, resolve the date range window.
 * Returns { from, to } as Date | undefined. undefined means no filter.
 */
function resolveDateRange(
  fromParam: string | undefined,
  toParam: string | undefined,
): { from: Date | undefined; to: Date | undefined } {
  if (!fromParam && !toParam) return { from: undefined, to: undefined }

  const from = fromParam ? new Date(fromParam) : undefined
  const to = toParam ? new Date(toParam) : undefined

  // Validate dates
  if (from && isNaN(from.getTime())) return { from: undefined, to: undefined }
  if (to && isNaN(to.getTime())) return { from: undefined, to: undefined }

  return {
    from: from ? startOfDay(from) : undefined,
    to: to ? endOfDay(to) : undefined,
  }
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

interface AnalyticsPageProps {
  searchParams: Promise<{
    from?: string
    to?: string
    aeIds?: string
    rtYear?: string
  }>
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams
  const rtYear = Number(params.rtYear ?? 2026)

  const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const rtYearSuffix = String(rtYear).slice(2)
  const RT_MONTHS = Array.from({ length: 12 }, (_, i) => ({
    bp: `${rtYearSuffix}-${String(i + 1).padStart(2, "0")}`,
    label: `${MONTH_ABBR[i]} ${rtYearSuffix}`,
  }))

  const { from, to } = resolveDateRange(params.from, params.to)

  // Parse AE filter — comma-separated user IDs
  const aeIds: string[] =
    params.aeIds && params.aeIds.trim().length > 0
      ? params.aeIds.split(",").map((s) => s.trim()).filter(Boolean)
      : []

  // Fetch current user for role-based AE filter enforcement
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  const currentDbUser = authUser?.email
    ? await prisma.user.findUnique({
        where: { email: authUser.email },
        select: { id: true, role: true },
      })
    : null

  // For account role, force filter to own AE ID regardless of URL params
  const effectiveAeIds: string[] =
    currentDbUser?.role === "account" && currentDbUser.id
      ? [currentDbUser.id]
      : aeIds

  // ---------------------------------------------------------------------------
  // Date range where clauses
  // Closed-stage leads: filter on closedAt when present; fallback to createdAt
  // Funnel/all leads: filter on createdAt
  // ---------------------------------------------------------------------------

  const closedDateFilter =
    from || to
      ? {
          OR: [
            {
              closedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
            {
              closedAt: null,
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
          ],
        }
      : {}

  const createdDateFilter =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}

  // AE filter clause — uses effectiveAeIds (enforced for account role)
  const aeFilter = effectiveAeIds.length > 0 ? { salesId: { in: effectiveAeIds } } : {}

  const [
    allLeadsByAE,
    wonLeadsByAE,
    lostLeadsByAE,
    aeRevenueByAE,
    leadsForIndustry,
    revenueTrendLeads,
    funnelGroups,
    funnelRevenueGroups,
    renewedCount,
    totalClientCount,
    aeUsers,
    allAEUsers,
    upsellWonCount,
    overallStageGroups,
    revenueByProductLineGroups,
    pipelineValueAgg,
    lostReasonGroups,
  ] = await Promise.all([
    // 1a. All leads per AE (has salesId) — funnel filter = createdAt
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        deletedAt: null,
        salesId: { not: null },
        ...aeFilter,
        ...createdDateFilter,
      },
      _count: { _all: true },
    }),

    // 1b. Won leads per AE — filter on closedAt
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        deletedAt: null,
        salesId: { not: null },
        stage: { in: WON_STAGES },
        ...aeFilter,
        ...closedDateFilter,
      },
      _count: { _all: true },
    }),

    // 1c. Lost leads per AE — filter on closedAt
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        deletedAt: null,
        salesId: { not: null },
        stage: { in: LOST_STAGES },
        ...aeFilter,
        ...closedDateFilter,
      },
      _count: { _all: true },
    }),

    // 6. Revenue per AE (won only) — filter on closedAt
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        deletedAt: null,
        salesId: { not: null },
        stage: { in: WON_STAGES },
        actualRevenue: { not: null },
        ...aeFilter,
        ...closedDateFilter,
      },
      _sum: { actualRevenue: true },
    }),

    // 2. All leads with client industry — createdAt filter (active only)
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...aeFilter,
        ...createdDateFilter,
      },
      select: {
        stage: true,
        client: { select: { industry: true } },
      },
    }),

    // 3. Revenue trend leads — all stages with any revenue value, dynamic year window (active only)
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        billingPlan: { in: RT_MONTHS.map((m) => m.bp) },
        OR: [
          { actualRevenue: { not: null } },
          { projectedRevenue: { not: null } },
        ],
        ...aeFilter,
      },
      select: {
        stage: true,
        billingPlan: true,
        actualRevenue: true,
        projectedRevenue: true,
      },
    }),

    // 4. Funnel stage counts — createdAt filter (active only)
    prisma.lead.groupBy({
      by: ["stage"],
      where: {
        deletedAt: null,
        ...aeFilter,
        ...createdDateFilter,
      },
      _count: { _all: true },
    }),

    // 4b. Funnel revenue — projected + actual revenue per stage (active only)
    prisma.lead.groupBy({
      by: ["stage"],
      _sum: { projectedRevenue: true, actualRevenue: true },
      where: {
        deletedAt: null,
        ...aeFilter,
        ...createdDateFilter,
      },
    }),

    // 5a. Renewed client count — distinct clientIds with contract_renewal (active only)
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        stage: "contract_renewal",
        ...aeFilter,
        ...closedDateFilter,
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),

    // 5b. Total client count (active only — retention denominator)
    prisma.client.count({ where: { deletedAt: null } }),

    // AE users for name resolution (account + admin + commercial_director + account_manager can own leads)
    prisma.user.findMany({
      where: { role: { in: ["account", "admin", "commercial_director", "account_manager"] } },
      select: { id: true, name: true },
    }),

    // All active users who can own leads — for filter dropdown
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["account", "admin", "commercial_director", "account_manager"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // Upsell won — UpsellOpportunity records with status = won
    prisma.upsellOpportunity.count({
      where: {
        status: "won",
        ...(effectiveAeIds.length > 0
          ? { client: { primaryAe: { in: effectiveAeIds } } }
          : {}),
      },
    }),

    // Overall win rate — stage counts for all pitched leads (active only)
    prisma.lead.groupBy({
      by: ["stage"],
      where: {
        deletedAt: null,
        ...aeFilter,
        ...closedDateFilter,
      },
      _count: { _all: true },
    }),

    // Revenue by product line (won deals only, active only)
    prisma.lead.groupBy({
      by: ["productLine"],
      where: {
        deletedAt: null,
        stage: { in: WON_STAGES },
        actualRevenue: { not: null },
        ...aeFilter,
        ...closedDateFilter,
      },
      _sum: { actualRevenue: true },
      orderBy: { _sum: { actualRevenue: "desc" } },
    }),

    // Active pipeline value — leads in active (pre-won) stages (active only)
    prisma.lead.aggregate({
      _sum: { projectedRevenue: true },
      where: {
        deletedAt: null,
        stage: { in: ["leads", "pipeline", "negotiation"] },
        ...aeFilter,
      },
    }),

    // Lost reason distribution — lost_deal leads (active only)
    prisma.lead.groupBy({
      by: ["lostReason"],
      where: {
        deletedAt: null,
        stage: $Enums.PipelineStage.lost_deal,
        ...aeFilter,
        ...createdDateFilter,
      },
      _count: { _all: true },
      orderBy: { _count: { lostReason: "desc" } },
    }),
  ])

  const revenueByProductLine: RevenueByProductLine[] = revenueByProductLineGroups.map((r) => ({
    productLine: r.productLine,
    revenue: Number(r._sum.actualRevenue ?? 0),
  }))

  const pipelineValue = Number(pipelineValueAgg._sum.projectedRevenue ?? 0)

  // ---------------------------------------------------------------------------
  // 1 + 6: Win Rate per AE + AE performance table
  // ---------------------------------------------------------------------------

  const aeNameMap = new Map(aeUsers.map((u) => [u.id, u.name]))

  // Fallback: collect all salesIds present in leads, fetch any missing users
  const allSalesIds = allLeadsByAE
    .map((g) => g.salesId)
    .filter((id): id is string => id !== null)

  const missingIds = allSalesIds.filter((id) => !aeNameMap.has(id))
  if (missingIds.length > 0) {
    const extraUsers = await prisma.user.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, name: true },
    })
    extraUsers.forEach((u) => aeNameMap.set(u.id, u.name))
  }

  const wonByAEMap = new Map(
    wonLeadsByAE.map((g) => [g.salesId, g._count._all])
  )
  const lostByAEMap = new Map(
    lostLeadsByAE.map((g) => [g.salesId, g._count._all])
  )
  const revenueByAEMap = new Map(
    aeRevenueByAE.map((g) => [g.salesId, Number(g._sum.actualRevenue ?? 0)])
  )

  const winRateByAE: WinRateByAE[] = allLeadsByAE
    .map((g) => {
      const salesId = g.salesId as string
      const total = g._count._all
      const won = wonByAEMap.get(salesId) ?? 0
      const lost = lostByAEMap.get(salesId) ?? 0
      const revenue = revenueByAEMap.get(salesId) ?? 0
      const closed = won + lost
      const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0
      return {
        aeId: salesId,
        aeName: aeNameMap.get(salesId) ?? "Unknown",
        total,
        won,
        lost,
        winRate,
        revenue,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // ---------------------------------------------------------------------------
  // 2: Win Rate per Industry
  // ---------------------------------------------------------------------------

  const industryMap = new Map<
    string,
    { total: number; won: number }
  >()

  for (const lead of leadsForIndustry) {
    const industry = lead.client.industry ?? "Unknown"
    const existing = industryMap.get(industry) ?? { total: 0, won: 0 }
    existing.total += 1
    if (WON_STAGES.includes(lead.stage)) {
      existing.won += 1
    }
    industryMap.set(industry, existing)
  }

  const winRateByIndustry: WinRateByIndustry[] = Array.from(
    industryMap.entries()
  )
    .map(([industry, { total, won }]) => ({
      industry,
      total,
      won,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // ---------------------------------------------------------------------------
  // Revenue Trend (Sprint 7.1) — Fixed Jan–Dec 2026, 3 stage-group lines
  // ---------------------------------------------------------------------------

  const WON_STAGES_TREND = new Set(["closed_won", "invoiced"])
  const ACTIVE_STAGES_TREND = new Set(["pipeline", "negotiation", "contract_renewal"])
  const POTENTIAL_STAGES_TREND = new Set(["leads"])

  const wonByMonth = new Map<string, number>()
  const activeByMonth = new Map<string, number>()
  const potentialByMonth = new Map<string, number>()
  for (const { label } of RT_MONTHS) {
    wonByMonth.set(label, 0)
    activeByMonth.set(label, 0)
    potentialByMonth.set(label, 0)
  }

  const bp2026LabelMap = new Map(RT_MONTHS.map(({ bp, label }) => [bp, label]))

  for (const lead of revenueTrendLeads) {
    if (!lead.billingPlan) continue
    const label = bp2026LabelMap.get(lead.billingPlan)
    if (!label) continue
    const stage = lead.stage as string
    if (WON_STAGES_TREND.has(stage)) {
      const rev = lead.actualRevenue !== null
        ? Number(lead.actualRevenue)
        : lead.projectedRevenue !== null
          ? Number(lead.projectedRevenue)
          : 0
      if (rev > 0) wonByMonth.set(label, (wonByMonth.get(label) ?? 0) + rev)
    } else if (ACTIVE_STAGES_TREND.has(stage) && lead.projectedRevenue !== null) {
      activeByMonth.set(label, (activeByMonth.get(label) ?? 0) + Number(lead.projectedRevenue))
    } else if (POTENTIAL_STAGES_TREND.has(stage) && lead.projectedRevenue !== null) {
      potentialByMonth.set(label, (potentialByMonth.get(label) ?? 0) + Number(lead.projectedRevenue))
    }
  }

  const revenueTrend: RevenueTrendPoint[] = RT_MONTHS.map(({ label }) => ({
    month: label,
    won: wonByMonth.get(label) ?? 0,
    active: activeByMonth.get(label) ?? 0,
    potential: potentialByMonth.get(label) ?? 0,
  }))

  // ---------------------------------------------------------------------------
  // 4: Pipeline Funnel
  // ---------------------------------------------------------------------------

  const stageCountMap = new Map(
    funnelGroups.map((g) => [g.stage, g._count._all])
  )

  const funnelRevenueMap = new Map(
    funnelRevenueGroups.map((r) => [
      r.stage as string,
      Number(r._sum.projectedRevenue ?? 0) + Number(r._sum.actualRevenue ?? 0),
    ])
  )

  const pipelineFunnel: FunnelStage[] = FUNNEL_ORDER.map(({ key, label }) => ({
    stage: key,
    label,
    count: stageCountMap.get(key as $Enums.PipelineStage) ?? 0,
    conversionRate: null,
    revenue: funnelRevenueMap.get(key) ?? 0,
  }))

  // Compute stage-to-stage conversion rates
  for (let i = 1; i < pipelineFunnel.length; i++) {
    const prev = pipelineFunnel[i - 1]
    const curr = pipelineFunnel[i]
    curr.conversionRate = prev.count > 0
      ? Math.round((curr.count / prev.count) * 100)
      : null
  }

  // ---------------------------------------------------------------------------
  // 5: Client Retention
  // ---------------------------------------------------------------------------

  const renewedClientCount = renewedCount.length
  const retentionRate =
    totalClientCount > 0
      ? Math.round((renewedClientCount / totalClientCount) * 100)
      : 0

  const clientRetention: ClientRetention = {
    renewed: renewedClientCount,
    upsellWon: upsellWonCount,
    total: totalClientCount,
    rate: retentionRate,
  }

  // ---------------------------------------------------------------------------
  // Overall Win Rate (Sprint 5.1)
  // Denominator: lost_deal + pipeline + negotiation + closed_won + invoiced + contract_renewal
  // Exclude: leads (pre-pitch), no_response
  // ---------------------------------------------------------------------------
  const overallStageCountMap = new Map(
    overallStageGroups.map((g) => [g.stage as string, g._count._all])
  )
  const PITCHED_STAGES = ["pipeline", "negotiation", "closed_won", "invoiced", "contract_renewal", "lost_deal"]
  const overallDenominator = PITCHED_STAGES.reduce(
    (sum, s) => sum + (overallStageCountMap.get(s) ?? 0),
    0
  )
  const overallLost = overallStageCountMap.get("lost_deal") ?? 0
  const overallWinRate: OverallWinRate = {
    lost: overallLost,
    denominator: overallDenominator,
    winLossRate: overallDenominator > 0 ? Math.round((overallLost / overallDenominator) * 100) : 0,
  }

  // ---------------------------------------------------------------------------
  // Lost Reason Distribution
  // ---------------------------------------------------------------------------
  const LOST_REASON_LABELS: Record<string, string> = {
    budget: "Budget Tidak Cocok",
    competitor: "Kalah dari Kompetitor",
    timing: "Timing Tidak Tepat",
    no_decision: "Tidak Ada Keputusan",
    requirements_mismatch: "Kebutuhan Tidak Cocok",
    other: "Lainnya",
  }

  const lostReasonDist: LostReasonDist[] = lostReasonGroups.map((g) => ({
    reason: g.lostReason ? (LOST_REASON_LABELS[g.lostReason] ?? g.lostReason) : "(belum dikategorikan)",
    count: g._count._all,
  })).sort((a, b) => b.count - a.count)

  return (
    <>
      <Topbar title="Analytics" />
      <AnalyticsContent
        winRateByAE={winRateByAE}
        winRateByIndustry={winRateByIndustry}
        revenueTrend={revenueTrend}
        pipelineFunnel={pipelineFunnel}
        clientRetention={clientRetention}
        aePerformance={winRateByAE}
        allAEUsers={allAEUsers}
        activeFrom={params.from}
        activeTo={params.to}
        activeAeIds={params.aeIds}
        currentUserRole={currentDbUser?.role ?? null}
        overallWinRate={overallWinRate}
        rtYear={rtYear}
        revenueByProductLine={revenueByProductLine}
        pipelineValue={pipelineValue}
        lostReasonDist={lostReasonDist}
      />
    </>
  )
}
