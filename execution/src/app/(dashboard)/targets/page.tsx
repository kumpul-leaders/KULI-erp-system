import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
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
  salesId: string | null
  createdAt: string
  updatedAt: string
}

export type AeOption = {
  id: string
  name: string
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

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ aeId?: string }>
}) {
  const { aeId } = await searchParams
  const selectedAeId = aeId ?? null

  // Resolve current user role for admin gate
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const dbUser = authUser
    ? await prisma.user.findUnique({
        where: { email: authUser.email! },
        select: { role: true },
      })
    : null
  const userRole = dbUser?.role ?? null

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

  // Target filter: when AE selected, show that AE's targets only.
  // Company view: salesId = null (company-wide).
  const targetWhereClause = selectedAeId
    ? { salesId: selectedAeId }
    : { salesId: null }

  // Unique constraint name changed — use findFirst for null-safe lookup
  const findCurrentMonthTarget = () =>
    prisma.target.findFirst({
      where: {
        periodMonth: currentMonth,
        periodYear: currentYear,
        type: "monthly" as $Enums.TargetType,
        salesId: selectedAeId ?? null,
      },
    })

  const findCurrentQuarterTarget = () =>
    prisma.target.findFirst({
      where: {
        periodMonth: currentQuarter,
        periodYear: currentYear,
        type: "quarterly" as $Enums.TargetType,
        salesId: selectedAeId ?? null,
      },
    })

  const [
    aeOptions,
    allTargets,
    currentMonthTarget,
    currentQuarterTarget,
    monthlyRevenueAgg,
    monthlyNewClientLeads,
    quarterlyRevenueAgg,
    quarterlyNewClientLeads,
  ] = await Promise.all([
    // 0. Active AEs for the selector (account + admin + account_manager roles)
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["account", "admin", "account_manager"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // 1. All targets for selected view (AE or company-wide)
    prisma.target.findMany({
      where: targetWhereClause,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    }),

    // 2. Current month target
    findCurrentMonthTarget(),

    // 3. Current quarter target
    findCurrentQuarterTarget(),

    // 4. Monthly actual revenue (won leads with billing plan = current month)
    // Note: actualRevenue is company-wide regardless of AE selection
    prisma.lead.aggregate({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      _sum: { actualRevenue: true },
    }),

    // 5. Monthly actual new clients
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      select: { clientId: true },
      distinct: ["clientId"],
    }),

    // 6. Quarterly actual revenue
    prisma.lead.aggregate({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: { in: qBillingPlans },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      _sum: { actualRevenue: true },
    }),

    // 7. Quarterly actual new clients
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: { in: qBillingPlans },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
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
    salesId: string | null
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
      salesId: t.salesId,
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
        aeOptions={aeOptions}
        selectedAeId={selectedAeId}
        userRole={userRole}
      />
    </>
  )
}
