import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { TargetsContent } from "@/components/targets/targets-content"
import { $Enums } from "@prisma/client"
import { getStageConfig } from "@/lib/stage-config.server"

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
  weightedPipeline: number // SUM(projectedRevenue × probability/100) for forecast-eligible stages
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
  searchParams: Promise<{ aeId?: string; year?: string }>
}) {
  const { aeId, year: yearParam } = await searchParams
  const selectedAeId = aeId ?? null

  const parsedYear = Number(yearParam)
  const YEAR = !isNaN(parsedYear) && parsedYear >= 2024 && parsedYear <= 2030
    ? parsedYear
    : new Date().getFullYear()

  // Role check
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const dbUser = authUser
    ? await prisma.user.findUnique({ where: { email: authUser.email! }, select: { role: true } })
    : null
  const userRole = dbUser?.role ?? null

  const yearPrefix = YEAR.toString().slice(2)
  const allBP = Array.from({ length: 12 }, (_, i) =>
    `${yearPrefix}-${String(i + 1).padStart(2, "0")}`
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

  // Fetch stage config for weighted pipeline calculation
  const stageConfig = await getStageConfig()
  const forecastStages = (Object.entries(stageConfig) as [string, { countsAsForecast: boolean }][])
    .filter(([, cfg]) => cfg.countsAsForecast)
    .map(([stage]) => stage)

  const [aeOptions, quarterlyTargets, wonLeads, pipelineLeads, weightedPipelineLeads] = await Promise.all([
    // Active AEs for the selector
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // All quarterly targets for the selected year (company-wide or per-AE)
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
        billingPlan: { in: allBP },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      select: { actualRevenue: true, projectedRevenue: true, billingPlan: true },
    }),

    // Forecast revenue: pipeline + negotiation + contract_renewal
    prisma.lead.findMany({
      where: {
        stage: { in: ["pipeline", "negotiation", "contract_renewal"] },
        billingPlan: { in: allBP },
        ...(selectedAeId ? { salesId: selectedAeId } : {}),
      },
      select: { projectedRevenue: true, actualRevenue: true, billingPlan: true },
    }),

    // Weighted pipeline: forecast stages × probability for coverage ratio
    forecastStages.length > 0
      ? prisma.lead.findMany({
          where: {
            stage: { in: forecastStages as $Enums.PipelineStage[] },
            billingPlan: { in: allBP },
            projectedRevenue: { not: null },
            probability: { not: null },
            ...(selectedAeId ? { salesId: selectedAeId } : {}),
          },
          select: { projectedRevenue: true, probability: true, billingPlan: true },
        })
      : Promise.resolve([]),
  ])

  // Build billing plan → actual revenue map
  // closed_won/invoiced may not have actualRevenue filled yet — fall back to projectedRevenue
  const bpActualMap = new Map<string, number>()
  for (const lead of wonLeads) {
    if (!lead.billingPlan) continue
    const value = lead.actualRevenue ?? lead.projectedRevenue
    if (!value) continue
    bpActualMap.set(lead.billingPlan, (bpActualMap.get(lead.billingPlan) ?? 0) + Number(value))
  }

  // Build billing plan → forecast revenue map (pipeline + negotiation + contract_renewal)
  // Use projectedRevenue, fall back to actualRevenue (contract_renewal may have actual set)
  const bpForecastMap = new Map<string, number>()
  for (const lead of pipelineLeads) {
    if (!lead.billingPlan) continue
    const value = lead.projectedRevenue ?? lead.actualRevenue
    if (!value) continue
    bpForecastMap.set(lead.billingPlan, (bpForecastMap.get(lead.billingPlan) ?? 0) + Number(value))
  }

  // Build billing plan → weighted pipeline map (projectedRevenue × probability/100)
  const bpWeightedMap = new Map<string, number>()
  for (const lead of weightedPipelineLeads) {
    if (!lead.billingPlan || lead.projectedRevenue === null || lead.probability === null) continue
    const weighted = Number(lead.projectedRevenue) * (Number(lead.probability) / 100)
    bpWeightedMap.set(lead.billingPlan, (bpWeightedMap.get(lead.billingPlan) ?? 0) + weighted)
  }

  // Build target map: quarter → Target record
  const targetByQ = new Map(quarterlyTargets.map((t) => [t.periodMonth, t]))

  // Assemble QuarterData[]
  const quarters: QuarterData[] = QUARTERS.map(({ quarter, months }) => {
    const t = targetByQ.get(quarter)
    const monthsData = months.map((m) => {
      const bp = `${yearPrefix}-${String(m).padStart(2, "0")}`
      return {
        month: m,
        billingPlan: bp,
        actual: bpActualMap.get(bp) ?? 0,
        forecast: bpForecastMap.get(bp) ?? 0,
      }
    })
    const actual = monthsData.reduce((sum, md) => sum + md.actual, 0)
    const forecast = monthsData.reduce((sum, md) => sum + md.forecast, 0)
    const weightedPipeline = months.reduce((sum, m) => {
      const bp = `${yearPrefix}-${String(m).padStart(2, "0")}`
      return sum + (bpWeightedMap.get(bp) ?? 0)
    }, 0)
    return {
      quarter,
      targetId: t?.id ?? null,
      revenueTarget: t ? Number(t.revenueTarget) : 0,
      newClientTarget: t?.newClientTarget ?? 0,
      actual,
      forecast,
      weightedPipeline: Math.round(weightedPipeline),
      status: getQuarterStatus(quarter),
      months: monthsData,
    }
  })

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
