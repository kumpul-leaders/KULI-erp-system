import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { TargetsContent } from "@/components/targets/targets-content"
import { $Enums } from "@prisma/client"

export const metadata: Metadata = {
  title: "Targets",
}

// ---------------------------------------------------------------------------
// Serialized output types — no Decimal, no Date
// ---------------------------------------------------------------------------

export type SerializedTarget = {
  id: string
  periodMonth: number
  periodYear: number
  revenueTarget: number
  newClientTarget: number
  type: "monthly" | "quarterly"
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBillingPlan(year: number, month: number): string {
  return `${String(year).slice(2)}-${String(month).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function TargetsPage() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const currentQuarter = Math.ceil(currentMonth / 3)

  // Quarter billing plans — 3 months in the current quarter
  const qStartMonth = (currentQuarter - 1) * 3 + 1
  const qBillingPlans = Array.from({ length: 3 }, (_, i) =>
    toBillingPlan(currentYear, qStartMonth + i)
  )

  // Current month billing plan
  const currentBillingPlan = toBillingPlan(currentYear, currentMonth)

  const [
    allTargets,
    currentMonthTarget,
    currentQuarterTarget,
    monthlyRevenueAgg,
    monthlyNewClientLeads,
    quarterlyRevenueAgg,
    quarterlyNewClientLeads,
  ] = await Promise.all([
    // 1. All targets sorted most recent first
    prisma.target.findMany({
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    }),

    // 2. Current month target
    prisma.target.findUnique({
      where: {
        periodMonth_periodYear_type: {
          periodMonth: currentMonth,
          periodYear: currentYear,
          type: "monthly",
        },
      },
    }),

    // 3. Current quarter target
    prisma.target.findUnique({
      where: {
        periodMonth_periodYear_type: {
          periodMonth: currentQuarter,
          periodYear: currentYear,
          type: "quarterly",
        },
      },
    }),

    // 4. Monthly actual revenue (won leads with billing plan = current month)
    prisma.lead.aggregate({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
      },
      _sum: { actualRevenue: true },
    }),

    // 5. Monthly actual new clients (distinct clientIds, won leads with billing plan = current month)
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),

    // 6. Quarterly actual revenue (won leads with billing plan in current quarter months)
    prisma.lead.aggregate({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: { in: qBillingPlans },
      },
      _sum: { actualRevenue: true },
    }),

    // 7. Quarterly actual new clients (distinct clientIds, won leads in current quarter months)
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: { in: qBillingPlans },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
  ])

  // ---------------------------------------------------------------------------
  // Serialize — no Decimal or Date passed to client
  // ---------------------------------------------------------------------------

  function serializeTarget(t: {
    id: string
    periodMonth: number
    periodYear: number
    revenueTarget: { toNumber?: () => number } | null
    newClientTarget: number
    type: $Enums.TargetType
    createdAt: Date
    updatedAt: Date
  }): SerializedTarget {
    return {
      id: t.id,
      periodMonth: t.periodMonth,
      periodYear: t.periodYear,
      revenueTarget: t.revenueTarget ? Number(t.revenueTarget) : 0,
      newClientTarget: t.newClientTarget,
      type: t.type,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  }

  const serializedAllTargets = allTargets.map(serializeTarget)
  const serializedMonthTarget = currentMonthTarget ? serializeTarget(currentMonthTarget) : null
  const serializedQuarterTarget = currentQuarterTarget ? serializeTarget(currentQuarterTarget) : null

  const monthlyActual = {
    revenue: monthlyRevenueAgg._sum.actualRevenue
      ? Number(monthlyRevenueAgg._sum.actualRevenue)
      : 0,
    newClients: monthlyNewClientLeads.length,
  }

  const quarterlyActual = {
    revenue: quarterlyRevenueAgg._sum.actualRevenue
      ? Number(quarterlyRevenueAgg._sum.actualRevenue)
      : 0,
    newClients: quarterlyNewClientLeads.length,
  }

  return (
    <>
      <Topbar title="Targets" />
      <TargetsContent
        allTargets={serializedAllTargets}
        currentMonthTarget={serializedMonthTarget}
        currentQuarterTarget={serializedQuarterTarget}
        monthlyActual={monthlyActual}
        quarterlyActual={quarterlyActual}
        currentMonth={currentMonth}
        currentYear={currentYear}
        currentQuarter={currentQuarter}
      />
    </>
  )
}
