import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { AnalyticsContent } from "@/components/analytics/analytics-content"
import { $Enums } from "@prisma/client"

export const metadata: Metadata = {
  title: "Analytics",
}

// ---------------------------------------------------------------------------
// Serialized output types — no Decimal, no Date
// ---------------------------------------------------------------------------

export type WinRateByAE = {
  aeName: string
  total: number
  won: number
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
  month: string // e.g. "Jan 25"
  revenue: number
}

export type FunnelStage = {
  stage: string       // raw key
  label: string       // human-readable
  count: number
}

export type ClientRetention = {
  renewed: number
  total: number
  rate: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WON_STAGES: $Enums.PipelineStage[] = [
  $Enums.PipelineStage.closed_won,
  $Enums.PipelineStage.invoiced,
  $Enums.PipelineStage.contract_renewal,
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

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

function toBillingPlan(year: number, month: number): string {
  return `${String(year).slice(2)}-${String(month).padStart(2, "0")}`
}

export default async function AnalyticsPage() {
  const now = new Date()

  const [
    allLeadsByAE,
    wonLeadsByAE,
    aeRevenueByAE,
    leadsForIndustry,
    revenueLeads,
    funnelGroups,
    renewedCount,
    totalClientCount,
    aeUsers,
  ] = await Promise.all([
    // 1a. All leads per AE (has salesId)
    prisma.lead.groupBy({
      by: ["salesId"],
      where: { salesId: { not: null } },
      _count: { _all: true },
    }),

    // 1b. Won leads per AE
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        salesId: { not: null },
        stage: { in: WON_STAGES },
      },
      _count: { _all: true },
    }),

    // 6. Revenue per AE (won only)
    prisma.lead.groupBy({
      by: ["salesId"],
      where: {
        salesId: { not: null },
        stage: { in: WON_STAGES },
        actualRevenue: { not: null },
      },
      _sum: { actualRevenue: true },
    }),

    // 2. All leads with client industry
    prisma.lead.findMany({
      select: {
        stage: true,
        client: { select: { industry: true } },
      },
    }),

    // 3. Won leads with revenue + billingPlan for trend (excludes contract_renewal)
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        actualRevenue: { not: null },
        billingPlan: { not: null },
      },
      select: {
        actualRevenue: true,
        billingPlan: true,
      },
    }),

    // 4. Funnel stage counts
    prisma.lead.groupBy({
      by: ["stage"],
      _count: { _all: true },
    }),

    // 5a. Renewed client count (distinct clientIds with contract_renewal)
    prisma.lead.findMany({
      where: { stage: "contract_renewal" },
      select: { clientId: true },
      distinct: ["clientId"],
    }),

    // 5b. Total client count
    prisma.client.count(),

    // AE user names
    prisma.user.findMany({
      where: { role: "account" },
      select: { id: true, name: true },
    }),
  ])

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
  const revenueByAEMap = new Map(
    aeRevenueByAE.map((g) => [g.salesId, Number(g._sum.actualRevenue ?? 0)])
  )

  const winRateByAE: WinRateByAE[] = allLeadsByAE
    .map((g) => {
      const salesId = g.salesId as string
      const total = g._count._all
      const won = wonByAEMap.get(salesId) ?? 0
      const revenue = revenueByAEMap.get(salesId) ?? 0
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0
      return {
        aeName: aeNameMap.get(salesId) ?? "Unknown",
        total,
        won,
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
  // 3: Revenue Trend (12 months)
  // ---------------------------------------------------------------------------

  const revenueByMonth = new Map<string, number>()

  // Build the 12-month billing plan → display key map and pre-populate so empty months render as 0
  const billingPlanToKey = new Map<string, string>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const bp = toBillingPlan(d.getFullYear(), d.getMonth() + 1)
    const key = `${SHORT_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
    billingPlanToKey.set(bp, key)
    revenueByMonth.set(key, 0)
  }

  for (const lead of revenueLeads) {
    if (!lead.billingPlan) continue
    const key = billingPlanToKey.get(lead.billingPlan)
    if (key) {
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(lead.actualRevenue))
    }
  }

  const revenueTrend: RevenueTrendPoint[] = Array.from(
    revenueByMonth.entries()
  ).map(([month, revenue]) => ({ month, revenue }))

  // ---------------------------------------------------------------------------
  // 4: Pipeline Funnel
  // ---------------------------------------------------------------------------

  const stageCountMap = new Map(
    funnelGroups.map((g) => [g.stage, g._count._all])
  )

  const pipelineFunnel: FunnelStage[] = FUNNEL_ORDER.map(({ key, label }) => ({
    stage: key,
    label,
    count: stageCountMap.get(key as $Enums.PipelineStage) ?? 0,
  }))

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
    total: totalClientCount,
    rate: retentionRate,
  }

  return (
    <>
      <Topbar title="Analytics">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </Topbar>
      <AnalyticsContent
        winRateByAE={winRateByAE}
        winRateByIndustry={winRateByIndustry}
        revenueTrend={revenueTrend}
        pipelineFunnel={pipelineFunnel}
        clientRetention={clientRetention}
        aePerformance={winRateByAE}
      />
    </>
  )
}
