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

export type QuarterData = {
  quarter: number        // 1, 2, 3, or 4
  targetId: string | null
  revenueTarget: number  // 0 if no target set
  newClientTarget: number
  actual: number         // SUM actualRevenue from won leads in those 3 months
  forecast: number       // SUM projectedRevenue from pipeline leads in those 3 months
  status: "closed" | "active" | "future"
  months: {
    month: number        // 1-12
    billingPlan: string  // "26-01", "26-02", etc.
    actual: number       // SUM actualRevenue for that month
    forecast: number     // SUM projectedRevenue from pipeline leads for that month
  }[]
}

export type AeOption = {
  id: string
  name: string
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

  // Role check
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const dbUser = authUser
    ? await prisma.user.findUnique({ where: { email: authUser.email! }, select: { role: true } })
    : null
  const userRole = dbUser?.role ?? null

  const YEAR = 2026

  // Build billing plans for all 12 months of 2026
  const allBP2026 = Array.from({ length: 12 }, (_, i) =>
    `26-${String(i + 1).padStart(2, "0")}`
  )

  // Quarter definitions
  const QUARTERS = [
    { quarter: 1, months: [1, 2, 3] },
    { quarter: 2, months: [4, 5, 6] },
    { quarter: 3, months: [7, 8, 9] },
    { quarter: 4, months: [10, 11, 12] },
  ]

  // Current quarter status
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  function getQuarterStatus(q: number): "closed" | "active" | "future" {
    const qEndMonth = q * 3
    const qStartMonth = (q - 1) * 3 + 1
    if (currentYear > YEAR) return "closed"
    if (currentYear < YEAR) return "future"
    // same year
    if (currentMonth > qEndMonth) return "closed"
    if (currentMonth >= qStartMonth) return "active"
    return "future"
  }

  const [aeOptions, quarterlyTargets, wonLeads2026, pipelineLeads2026] = await Promise.all([
    // Active AEs for the selector
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // All quarterly targets for 2026 (company-wide or per-AE)
    prisma.target.findMany({
      where: {
        type: "quarterly" as $Enums.TargetType,
        periodYear: YEAR,
        salesId: selectedAeId ?? null,
      },
    }),

    // Actual revenue: closed_won + invoiced only
    prisma.lead.findMany({
      where: {
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: { in: allBP2026 },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      select: { actualRevenue: true, projectedRevenue: true, billingPlan: true },
    }),

    // Forecast revenue: pipeline + negotiation + contract_renewal
    prisma.lead.findMany({
      where: {
        stage: { in: ["pipeline", "negotiation", "contract_renewal"] },
        billingPlan: { in: allBP2026 },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      select: { projectedRevenue: true, actualRevenue: true, billingPlan: true },
    }),
  ])

  // Build billing plan → actual revenue map
  // closed_won/invoiced may not have actualRevenue filled yet — fall back to projectedRevenue
  const bpActualMap = new Map<string, number>()
  for (const lead of wonLeads2026) {
    if (!lead.billingPlan) continue
    const value = lead.actualRevenue ?? lead.projectedRevenue
    if (!value) continue
    bpActualMap.set(lead.billingPlan, (bpActualMap.get(lead.billingPlan) ?? 0) + Number(value))
  }

  // Build billing plan → forecast revenue map (pipeline + negotiation + contract_renewal)
  // Use projectedRevenue, fall back to actualRevenue (contract_renewal may have actual set)
  const bpForecastMap = new Map<string, number>()
  for (const lead of pipelineLeads2026) {
    if (!lead.billingPlan) continue
    const value = lead.projectedRevenue ?? lead.actualRevenue
    if (!value) continue
    bpForecastMap.set(lead.billingPlan, (bpForecastMap.get(lead.billingPlan) ?? 0) + Number(value))
  }

  // Build target map: quarter → Target record
  const targetByQ = new Map(quarterlyTargets.map((t) => [t.periodMonth, t]))

  // Assemble QuarterData[]
  const quarters: QuarterData[] = QUARTERS.map(({ quarter, months }) => {
    const t = targetByQ.get(quarter)
    const monthsData = months.map((m) => {
      const bp = `26-${String(m).padStart(2, "0")}`
      return {
        month: m,
        billingPlan: bp,
        actual: bpActualMap.get(bp) ?? 0,
        forecast: bpForecastMap.get(bp) ?? 0,
      }
    })
    const actual = monthsData.reduce((sum, md) => sum + md.actual, 0)
    const forecast = monthsData.reduce((sum, md) => sum + md.forecast, 0)
    return {
      quarter,
      targetId: t?.id ?? null,
      revenueTarget: t ? Number(t.revenueTarget) : 0,
      newClientTarget: t?.newClientTarget ?? 0,
      actual,
      forecast,
      status: getQuarterStatus(quarter),
      months: monthsData,
    }
  })

  // Annual summary: total target (sum of Q1-Q4), total actual (all won in 2026)
  const annualTarget = quarters.reduce((sum, q) => sum + q.revenueTarget, 0)
  const annualActual = Array.from(bpActualMap.values()).reduce((sum, v) => sum + v, 0)

  return (
    <>
      <Topbar title="Targets" />
      <TargetsContent
        quarters={quarters}
        annualTarget={annualTarget}
        annualActual={annualActual}
        year={YEAR}
        aeOptions={aeOptions}
        selectedAeId={selectedAeId}
        userRole={userRole}
      />
    </>
  )
}
