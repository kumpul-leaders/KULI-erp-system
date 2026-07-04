import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { prisma } from "@/lib/prisma"
import { getStageConfig } from "@/lib/stage-config.server"
import { $Enums } from "@prisma/client"

export const metadata: Metadata = {
  title: "Dashboard",
}

type SerializedLead = {
  id: string
  clientId: string
  clientName: string
  stage: string
  projectedRevenue: number | null
  actualRevenue: number | null
  quarter: string | null
  date: string // ISO string
}

type SerializedClient = {
  id: string
  name: string
  industry: string | null
  aeName: string | null
}

function toBillingPlan(year: number, month: number): string {
  return `${String(year).slice(2)}-${String(month).padStart(2, "0")}`
}

export default async function DashboardPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const currentBillingPlan = toBillingPlan(now.getFullYear(), now.getMonth() + 1)

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // Fetch stage config for weighted forecast
  const stageConfig = await getStageConfig()
  const forecastStages = (Object.entries(stageConfig) as [string, { countsAsForecast: boolean }][])
    .filter(([, cfg]) => cfg.countsAsForecast)
    .map(([stage]) => stage)

  const [
    wonLeads,
    pipelineLeads,
    prevMonthWon,
    healthyCount,
    newLeadsCount,
    currentTarget,
    atRiskCount,
    churnedCount,
    recentActivity,
    drillWonLeads,
    drillPipelineLeads,
    drillHealthyClients,
    drillNewLeads,
    drillAtRiskClients,
    drillChurnedClients,
    weightedForecastLeads,
  ] = await Promise.all([
    prisma.lead.aggregate({
      where: {
        deletedAt: null,
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
      },
      _sum: { actualRevenue: true },
    }),
    prisma.lead.aggregate({
      where: {
        deletedAt: null,
        stage: { in: ["leads", "pipeline", "negotiation"] },
      },
      _sum: { projectedRevenue: true },
    }),
    prisma.lead.aggregate({
      where: {
        deletedAt: null,
        stage: { in: ["closed_won", "invoiced", "contract_renewal"] },
        closedAt: { gte: prevMonthStart, lte: prevMonthEnd },
        actualRevenue: { not: null },
      },
      _sum: { actualRevenue: true },
    }),
    prisma.client.count({
      where: { deletedAt: null, healthStatus: "healthy" },
    }),
    prisma.lead.count({
      where: { deletedAt: null, createdAt: { gte: startOfMonth } },
    }),
    prisma.target.findFirst({
      where: {
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        type: "monthly",
      },
    }),
    prisma.client.count({ where: { deletedAt: null, healthStatus: "at_risk" } }),
    prisma.client.count({ where: { deletedAt: null, healthStatus: "churned" } }),
    prisma.leadStageHistory.findMany({
      take: 10,
      orderBy: { changedAt: "desc" },
      include: {
        lead: { select: { id: true, client: { select: { name: true } } } },
        changer: { select: { name: true } },
      },
    }),
    // Drill-down queries
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        stage: { in: ["closed_won", "invoiced"] },
        billingPlan: currentBillingPlan,
      },
      select: {
        id: true,
        stage: true,
        projectedRevenue: true,
        actualRevenue: true,
        quarter: true,
        billingPlan: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { actualRevenue: "desc" },
      take: 100,
    }),
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        stage: { in: ["leads", "pipeline", "negotiation"] },
      },
      select: {
        id: true,
        stage: true,
        projectedRevenue: true,
        actualRevenue: true,
        quarter: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { projectedRevenue: "desc" },
      take: 100,
    }),
    prisma.client.findMany({
      where: { deletedAt: null, healthStatus: "healthy" },
      select: {
        id: true,
        name: true,
        industry: true,
        ae: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      select: {
        id: true,
        stage: true,
        projectedRevenue: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.client.findMany({
      where: { deletedAt: null, healthStatus: "at_risk" },
      select: {
        id: true,
        name: true,
        industry: true,
        ae: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.client.findMany({
      where: { deletedAt: null, healthStatus: "churned" },
      select: {
        id: true,
        name: true,
        industry: true,
        ae: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    // Weighted forecast: all leads in forecast-eligible stages with projectedRevenue + probability
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        stage: forecastStages.length > 0 ? { in: forecastStages as $Enums.PipelineStage[] } : { in: [] as $Enums.PipelineStage[] },
        projectedRevenue: { not: null },
        probability: { not: null },
      },
      select: {
        id: true,
        stage: true,
        projectedRevenue: true,
        probability: true,
        quarter: true,
        client: { select: { id: true, name: true } },
      },
      take: 500,
    }),
  ])

  const revenueMTD = Number(wonLeads._sum.actualRevenue ?? 0)
  const revenueMTDPrevMonth = Number(prevMonthWon._sum.actualRevenue ?? 0)
  const revenueInPipeline = Number(pipelineLeads._sum.projectedRevenue ?? 0)
  const revenueTarget = Number(currentTarget?.revenueTarget ?? 0)
  const progressPct =
    revenueTarget > 0 ? Math.min((revenueMTD / revenueTarget) * 100, 100) : 0

  // Weighted forecast = SUM(projectedRevenue × probability / 100) for countsAsForecast stages
  const weightedForecast = weightedForecastLeads.reduce((sum, lead) => {
    const rev = lead.projectedRevenue !== null ? Number(lead.projectedRevenue) : 0
    const prob = lead.probability !== null ? Number(lead.probability) : 0
    return sum + rev * (prob / 100)
  }, 0)

  // Serialize weighted forecast drill-down leads
  type WeightedForecastLead = {
    id: string
    clientId: string
    clientName: string
    stage: string
    projectedRevenue: number | null
    probability: number
    quarter: string | null
  }
  const weightedForecastDrillDown: WeightedForecastLead[] = weightedForecastLeads.map((l) => ({
    id: l.id,
    clientId: l.client.id,
    clientName: l.client.name,
    stage: l.stage,
    projectedRevenue: l.projectedRevenue !== null ? Number(l.projectedRevenue) : null,
    probability: l.probability !== null ? Number(l.probability) : 0,
    quarter: l.quarter,
  }))

  const currentMonthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  // Serialize drill-down data
  const wonDrillDown: SerializedLead[] = drillWonLeads.map((l) => ({
    id: l.id,
    clientId: l.client.id,
    clientName: l.client.name,
    stage: l.stage,
    projectedRevenue:
      l.projectedRevenue !== null ? Number(l.projectedRevenue) : null,
    actualRevenue:
      l.actualRevenue !== null ? Number(l.actualRevenue) : null,
    quarter: l.quarter,
    date: l.billingPlan ?? "",
  }))

  const pipelineDrillDown: SerializedLead[] = drillPipelineLeads.map((l) => ({
    id: l.id,
    clientId: l.client.id,
    clientName: l.client.name,
    stage: l.stage,
    projectedRevenue:
      l.projectedRevenue !== null ? Number(l.projectedRevenue) : null,
    actualRevenue:
      l.actualRevenue !== null ? Number(l.actualRevenue) : null,
    quarter: l.quarter,
    date: l.createdAt.toISOString(),
  }))

  const healthyDrillDown: SerializedClient[] = drillHealthyClients.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    aeName: c.ae?.name ?? null,
  }))

  const newLeadsDrillDown: SerializedLead[] = drillNewLeads.map((l) => ({
    id: l.id,
    clientId: l.client.id,
    clientName: l.client.name,
    stage: l.stage,
    projectedRevenue:
      l.projectedRevenue !== null ? Number(l.projectedRevenue) : null,
    actualRevenue: null,
    quarter: null,
    date: l.createdAt.toISOString(),
  }))

  const atRiskDrillDown: SerializedClient[] = drillAtRiskClients.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    aeName: c.ae?.name ?? null,
  }))

  const churnedDrillDown: SerializedClient[] = drillChurnedClients.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    aeName: c.ae?.name ?? null,
  }))

  return (
    <>
      <Topbar title="Dashboard" />
      <DashboardContent
        revenueMTD={revenueMTD}
        revenueMTDPrevMonth={revenueMTDPrevMonth}
        revenueInPipeline={revenueInPipeline}
        weightedForecast={Math.round(weightedForecast)}
        healthyCount={healthyCount}
        newLeadsCount={newLeadsCount}
        revenueTarget={revenueTarget}
        progressPct={progressPct}
        currentMonthLabel={currentMonthLabel}
        atRiskCount={atRiskCount}
        churnedCount={churnedCount}
        recentActivity={recentActivity.map((a) => ({
          id: a.id,
          clientName: a.lead.client.name,
          leadId: a.lead.id,
          fromStage: a.fromStage,
          toStage: a.toStage,
          changerName: a.changer.name,
          changedAt: a.changedAt.toISOString(),
        }))}
        wonDrillDown={wonDrillDown}
        pipelineDrillDown={pipelineDrillDown}
        healthyDrillDown={healthyDrillDown}
        newLeadsDrillDown={newLeadsDrillDown}
        atRiskDrillDown={atRiskDrillDown}
        churnedDrillDown={churnedDrillDown}
        weightedForecastDrillDown={weightedForecastDrillDown}
      />
    </>
  )
}
