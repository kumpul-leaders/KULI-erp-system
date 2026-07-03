"use client"

import { useState } from "react"
import Link from "next/link"
import { formatIDR, formatIDRCompact, daysUntil, contractUrgency } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertsPanel } from "@/components/dashboard/alerts-panel"

// ---------------------------------------------------------------------------
// Shared serialized types (mirrors page.tsx — kept local, no shared file)
// ---------------------------------------------------------------------------

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

type WeightedForecastLead = {
  id: string
  clientId: string
  clientName: string
  stage: string
  projectedRevenue: number | null
  probability: number
  quarter: string | null
}

type SerializedClient = {
  id: string
  name: string
  industry: string | null
  aeName: string | null
  annualValue: number | null
  contractEnd: string | null // ISO string
}

// ---------------------------------------------------------------------------
// Drawer type + meta
// ---------------------------------------------------------------------------

type DrawerType =
  | "revenue_won"
  | "pipeline"
  | "healthy"
  | "leads_mtd"
  | "at_risk"
  | "churned"
  | "weighted_forecast"
  | null

const DRAWER_META: Record<
  NonNullable<DrawerType>,
  { title: string; description: string }
> = {
  revenue_won: {
    title: "Revenue Won MTD",
    description: "Leads yang sudah closed/invoiced bulan ini",
  },
  pipeline: {
    title: "Revenue in Pipeline",
    description: "Leads aktif di stages Leads, Pipeline, Negotiation",
  },
  healthy: {
    title: "Healthy Clients",
    description: "Klien dengan health status Healthy",
  },
  leads_mtd: {
    title: "New Leads MTD",
    description: "Leads baru yang masuk bulan ini",
  },
  at_risk: {
    title: "At Risk Clients",
    description: "Klien dengan health status At Risk",
  },
  churned: {
    title: "Churned Clients",
    description: "Klien dengan health status Churned",
  },
  weighted_forecast: {
    title: "Weighted Forecast",
    description: "Proyeksi revenue weighted by probability — hanya stages aktif (countsAsForecast)",
  },
}

// ---------------------------------------------------------------------------
// Utilities kept in client component (moved from page.tsx)
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  leads: "Leads",
  pipeline: "Pipeline",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  lost_deal: "Lost Deal",
  invoiced: "Invoiced",
  contract_renewal: "Contract Renewal",
  no_response: "No Response",
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Drill-down sub-components
// ---------------------------------------------------------------------------

function LeadDrillTable({
  leads,
  showActual,
}: {
  leads: SerializedLead[]
  showActual: boolean
}) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ col: "clientName" | "revenue" | "stage"; dir: "asc" | "desc" }>({ col: "revenue", dir: "desc" })

  const filtered = leads
    .filter((l) => l.clientName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      if (sort.col === "clientName") return a.clientName.localeCompare(b.clientName) * dir
      if (sort.col === "stage") return (a.stage).localeCompare(b.stage) * dir
      const aRev = showActual ? (a.actualRevenue ?? 0) : (a.projectedRevenue ?? 0)
      const bRev = showActual ? (b.actualRevenue ?? 0) : (b.projectedRevenue ?? 0)
      return (aRev - bRev) * dir
    })

  function toggleSort(col: typeof sort.col) {
    setSort((prev) => prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" })
  }

  function sortIndicator(col: typeof sort.col) {
    if (sort.col !== col) return null
    return sort.dir === "asc" ? " ↑" : " ↓"
  }

  return (
    <>
      <Input
        placeholder="Cari client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-8 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">Tidak ada data.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-100">
              <th
                className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 select-none"
                onClick={() => toggleSort("clientName")}
              >
                Client{sortIndicator("clientName")}
              </th>
              <th
                className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 select-none"
                onClick={() => toggleSort("stage")}
              >
                Stage{sortIndicator("stage")}
              </th>
              <th
                className="text-right text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 select-none"
                onClick={() => toggleSort("revenue")}
              >
                {showActual ? "Actual Revenue" : "Projected Revenue"}{sortIndicator("revenue")}
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 pb-2">
                Quarter
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-b border-neutral-100 dark:border-neutral-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-neutral-800 dark:text-neutral-700">
                  <Link
                    href={`/pipeline/${lead.id}`}
                    className="hover:text-accent-600 hover:underline"
                  >
                    {lead.clientName}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                  {formatIDR(showActual ? lead.actualRevenue : lead.projectedRevenue)}
                </td>
                <td className="py-2.5 text-xs text-neutral-400">
                  {lead.quarter ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </>
  )
}

function ClientDrillTable({ clients }: { clients: SerializedClient[] }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ col: "name" | "annualValue"; dir: "asc" | "desc" }>({ col: "name", dir: "asc" })

  const filtered = clients
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      if (sort.col === "name") return a.name.localeCompare(b.name) * dir
      return ((a.annualValue ?? 0) - (b.annualValue ?? 0)) * dir
    })

  function toggleSort(col: typeof sort.col) {
    setSort((prev) => prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" })
  }

  function sortIndicator(col: typeof sort.col) {
    if (sort.col !== col) return null
    return sort.dir === "asc" ? " ↑" : " ↓"
  }

  return (
    <>
      <Input
        placeholder="Cari client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-8 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">Tidak ada data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th
                className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none"
                onClick={() => toggleSort("name")}
              >
                Client{sortIndicator("name")}
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3">
                Industry
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3">
                Busdev/AE
              </th>
              <th
                className="text-right text-xs font-medium text-neutral-400 pb-2 cursor-pointer hover:text-neutral-600 select-none"
                onClick={() => toggleSort("annualValue")}
              >
                Annual Value{sortIndicator("annualValue")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr
                key={client.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="py-2.5 pr-3 font-medium text-neutral-800">
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:text-accent-600 hover:underline"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-3 text-xs text-neutral-500">
                  {client.industry ?? "—"}
                </td>
                <td className="py-2.5 pr-3 text-xs text-neutral-500">
                  {client.aeName ?? "—"}
                </td>
                <td className="py-2.5 text-right tabular-nums text-neutral-700">
                  {formatIDR(client.annualValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Weighted Forecast drill table
// ---------------------------------------------------------------------------

function WeightedForecastDrillTable({ leads }: { leads: WeightedForecastLead[] }) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ col: "clientName" | "weighted" | "stage"; dir: "asc" | "desc" }>({ col: "weighted", dir: "desc" })

  const filtered = leads
    .filter((l) => l.clientName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1
      if (sort.col === "clientName") return a.clientName.localeCompare(b.clientName) * dir
      if (sort.col === "stage") return a.stage.localeCompare(b.stage) * dir
      const aW = (a.projectedRevenue ?? 0) * (a.probability / 100)
      const bW = (b.projectedRevenue ?? 0) * (b.probability / 100)
      return (aW - bW) * dir
    })

  function toggleSort(col: typeof sort.col) {
    setSort((prev) => prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" })
  }

  function sortIndicator(col: typeof sort.col) {
    if (sort.col !== col) return null
    return sort.dir === "asc" ? " ↑" : " ↓"
  }

  return (
    <>
      <Input
        placeholder="Cari client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 h-8 text-sm"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">Tidak ada data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none" onClick={() => toggleSort("clientName")}>
                Client{sortIndicator("clientName")}
              </th>
              <th className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none" onClick={() => toggleSort("stage")}>
                Stage{sortIndicator("stage")}
              </th>
              <th className="text-right text-xs font-medium text-neutral-400 pb-2 pr-3">
                Projected
              </th>
              <th className="text-right text-xs font-medium text-neutral-400 pb-2 pr-3">
                Prob.
              </th>
              <th className="text-right text-xs font-medium text-neutral-400 pb-2 cursor-pointer hover:text-neutral-600 select-none" onClick={() => toggleSort("weighted")}>
                Weighted{sortIndicator("weighted")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const weighted = (lead.projectedRevenue ?? 0) * (lead.probability / 100)
              return (
                <tr key={lead.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-neutral-800">
                    <a href={`/pipeline/${lead.id}`} className="hover:text-accent-600 hover:underline">
                      {lead.clientName}
                    </a>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs text-neutral-500">{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-500 text-xs">
                    {lead.projectedRevenue != null ? formatIDR(lead.projectedRevenue) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-500 text-xs">
                    {lead.probability}%
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-neutral-700 font-medium">
                    {formatIDR(Math.round(weighted))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium ${up ? "text-success-700 dark:text-success-500" : "text-danger-600 dark:text-danger-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}% vs bulan lalu
    </span>
  )
}

interface DashboardContentProps {
  revenueMTD: number
  revenueMTDPrevMonth: number
  revenueInPipeline: number
  weightedForecast: number
  healthyCount: number
  newLeadsCount: number
  revenueTarget: number
  progressPct: number
  currentMonthLabel: string
  /** Kept for AlertsPanel fallback when no open alerts exist */
  expiringContracts: { id: string; name: string; contractEnd: string | null; monthlyValue: number | null; annualValue: number | null }[]
  atRiskCount: number
  churnedCount: number
  recentActivity: {
    id: string
    clientName: string
    leadId: string
    fromStage: string
    toStage: string
    changerName: string
    changedAt: string
  }[]
  wonDrillDown: SerializedLead[]
  pipelineDrillDown: SerializedLead[]
  healthyDrillDown: SerializedClient[]
  newLeadsDrillDown: SerializedLead[]
  atRiskDrillDown: SerializedClient[]
  churnedDrillDown: SerializedClient[]
  weightedForecastDrillDown: WeightedForecastLead[]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardContent({
  revenueMTD,
  revenueMTDPrevMonth,
  revenueInPipeline,
  weightedForecast,
  healthyCount,
  newLeadsCount,
  revenueTarget,
  progressPct,
  currentMonthLabel,
  expiringContracts,
  atRiskCount,
  churnedCount,
  recentActivity,
  wonDrillDown,
  pipelineDrillDown,
  healthyDrillDown,
  newLeadsDrillDown,
  atRiskDrillDown,
  churnedDrillDown,
  weightedForecastDrillDown,
}: DashboardContentProps) {
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null)

  function renderDrawerContent() {
    switch (activeDrawer) {
      case "revenue_won":
        return <LeadDrillTable leads={wonDrillDown} showActual={true} />
      case "pipeline":
        return <LeadDrillTable leads={pipelineDrillDown} showActual={false} />
      case "leads_mtd":
        return <LeadDrillTable leads={newLeadsDrillDown} showActual={false} />
      case "healthy":
        return <ClientDrillTable clients={healthyDrillDown} />
      case "at_risk":
        return <ClientDrillTable clients={atRiskDrillDown} />
      case "churned":
        return <ClientDrillTable clients={churnedDrillDown} />
      case "weighted_forecast":
        return <WeightedForecastDrillTable leads={weightedForecastDrillDown} />
      default:
        return null
    }
  }

  const drawerMeta =
    activeDrawer !== null ? DRAWER_META[activeDrawer] : { title: "", description: "" }

  return (
    <>
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {/* KPI strip — 2 cols mobile, 3 cols sm, 5 cols xl */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
          {/* Card 1 — Revenue Won MTD */}
          <button
            onClick={() => setActiveDrawer("revenue_won")}
            className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-4 md:p-5 shadow-card text-left w-full min-w-0 hover:border-accent-200 dark:hover:border-accent-200/30 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate">
              Revenue Won MTD
            </p>
            <p className="text-2xl font-bold tabular-nums text-neutral-800 dark:text-neutral-700 mb-0.5 truncate">
              {formatIDRCompact(revenueMTD)}
            </p>
            <p className="text-[11px] tabular-nums text-neutral-400 mb-1 truncate">
              {formatIDR(revenueMTD)}
            </p>
            {revenueMTDPrevMonth > 0 && (
              <TrendBadge current={revenueMTD} prev={revenueMTDPrevMonth} />
            )}
          </button>

          {/* Card 2 — Revenue in Pipeline */}
          <button
            onClick={() => setActiveDrawer("pipeline")}
            className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-4 md:p-5 shadow-card text-left w-full min-w-0 hover:border-accent-200 dark:hover:border-accent-200/30 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate">
              Revenue in Pipeline
            </p>
            <p className="text-2xl font-bold tabular-nums text-neutral-800 dark:text-neutral-700 mb-0.5 truncate">
              {formatIDRCompact(revenueInPipeline)}
            </p>
            <p className="text-[11px] tabular-nums text-neutral-400 mb-1 truncate">
              {formatIDR(revenueInPipeline)}
            </p>
            <p className="text-xs text-neutral-400">Active stages</p>
          </button>

          {/* Card 3 — Weighted Forecast */}
          <button
            onClick={() => setActiveDrawer("weighted_forecast")}
            className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-4 md:p-5 shadow-card text-left w-full min-w-0 hover:border-accent-200 dark:hover:border-accent-200/30 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate">
              Weighted Forecast
            </p>
            <p className="text-2xl font-bold tabular-nums text-neutral-800 dark:text-neutral-700 mb-0.5 truncate">
              {formatIDRCompact(weightedForecast)}
            </p>
            <p className="text-[11px] tabular-nums text-neutral-400 mb-1 truncate">
              {formatIDR(weightedForecast)}
            </p>
            <p className="text-xs text-neutral-400">Pipeline × prob.</p>
          </button>

          {/* Card 4 — Healthy Clients */}
          <button
            onClick={() => setActiveDrawer("healthy")}
            className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-4 md:p-5 shadow-card text-left w-full min-w-0 hover:border-accent-200 dark:hover:border-accent-200/30 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate">
              Healthy Clients
            </p>
            <p className="text-2xl font-bold tabular-nums text-neutral-800 dark:text-neutral-700 mb-1">
              {healthyCount.toString()}
            </p>
            <p className="text-xs text-neutral-400">Health: healthy</p>
          </button>

          {/* Card 5 — New Leads MTD */}
          <button
            onClick={() => setActiveDrawer("leads_mtd")}
            className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-4 md:p-5 shadow-card text-left w-full min-w-0 hover:border-accent-200 dark:hover:border-accent-200/30 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2 truncate">
              New Leads MTD
            </p>
            <p className="text-2xl font-bold tabular-nums text-neutral-800 dark:text-neutral-700 mb-1">
              {newLeadsCount.toString()}
            </p>
            <p className="text-xs text-neutral-400 truncate">{currentMonthLabel}</p>
          </button>
        </div>

        {/* Two-column body — equal halves on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Left col */}
          <div className="space-y-4 md:space-y-6">
            {/* Revenue vs Target */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-700">
                  Revenue vs Target
                </h2>
                <span className="text-xs text-neutral-400">
                  {currentMonthLabel}
                </span>
              </div>
              {revenueTarget === 0 ? (
                <p className="text-sm text-neutral-400">
                  Belum ada target bulan ini. Set target di{" "}
                  <Link
                    href="/targets"
                    className="text-accent-500 underline underline-offset-2 hover:text-accent-600"
                  >
                    Targets
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
                      <span className="tabular-nums">{formatIDRCompact(revenueMTD)}</span>
                      <span className="tabular-nums">{formatIDRCompact(revenueTarget)}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs text-neutral-400">
                      {progressPct.toFixed(1)}% of target reached
                    </p>
                    <p className="text-xs tabular-nums text-neutral-400">
                      {formatIDR(revenueMTD)} / {formatIDR(revenueTarget)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Recent Pipeline Activity — scrollable, shows all 10 */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-700">
                  Recent Pipeline Activity
                </h2>
                {recentActivity.length > 0 && (
                  <span className="text-xs text-neutral-400">{recentActivity.length} events</span>
                )}
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-400 py-2">
                  Belum ada aktivitas pipeline.
                </p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto -mr-1 pr-1">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 py-2.5 border-b border-neutral-100 dark:border-neutral-100 last:border-0"
                    >
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-700 dark:text-neutral-700 truncate">
                          <Link
                            href={`/pipeline/${activity.leadId}`}
                            className="font-medium hover:text-accent-600 hover:underline"
                          >
                            {activity.clientName}
                          </Link>
                          {" — "}
                          <span className="text-neutral-500 dark:text-neutral-400">
                            {STAGE_LABELS[activity.fromStage] ?? activity.fromStage}
                          </span>
                          {" "}
                          <span className="text-neutral-400">&rarr;</span>
                          {" "}
                          <span className="text-neutral-700 dark:text-neutral-700">
                            {STAGE_LABELS[activity.toStage] ?? activity.toStage}
                          </span>
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          by {activity.changerName} &middot;{" "}
                          {relativeTime(activity.changedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-4 md:space-y-6">
            {/* Alerts — live from /api/alerts?status=open; falls back to expiring contracts */}
            <AlertsPanel
              expiringContracts={expiringContracts.map((c) => ({
                id: c.id,
                name: c.name,
                contractEnd: c.contractEnd,
              }))}
            />

            {/* Client Health */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-700 mb-4">
                Client Health
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveDrawer("healthy")}
                  className="flex-1 rounded-lg bg-success-50 p-3 text-center hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-success-700">
                    {healthyCount}
                  </p>
                  <p className="text-xs text-success-700 mt-0.5">Healthy</p>
                </button>
                <button
                  onClick={() => setActiveDrawer("at_risk")}
                  className="flex-1 rounded-lg bg-warning-50 p-3 text-center hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-warning-700">
                    {atRiskCount}
                  </p>
                  <p className="text-xs text-warning-700 mt-0.5">At Risk</p>
                </button>
                <button
                  onClick={() => setActiveDrawer("churned")}
                  className="flex-1 rounded-lg bg-danger-50 p-3 text-center hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-danger-700">
                    {churnedCount}
                  </p>
                  <p className="text-xs text-danger-700 mt-0.5">Churned</p>
                </button>
              </div>
            </div>

            {/* Expiring Contracts — 90 days, data already in props */}
            {expiringContracts.length > 0 && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-700">
                    Kontrak Berakhir 90 Hari
                  </h2>
                  <span className="text-xs text-neutral-400">{expiringContracts.length} klien</span>
                </div>
                <div className="space-y-2">
                  {expiringContracts.map((c) => {
                    const days = c.contractEnd ? daysUntil(c.contractEnd) : null
                    const urgency = days !== null ? contractUrgency(days) : "none"
                    const urgencyColor =
                      urgency === "critical"
                        ? "text-danger-700 dark:text-danger-500"
                        : urgency === "warning"
                        ? "text-warning-700 dark:text-warning-500"
                        : "text-neutral-500 dark:text-neutral-400"
                    const dotColor =
                      urgency === "critical"
                        ? "bg-danger-500"
                        : urgency === "warning"
                        ? "bg-warning-500"
                        : "bg-neutral-300 dark:bg-neutral-500"
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 py-2 border-b border-neutral-100 dark:border-neutral-100 last:border-0"
                      >
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/clients/${c.id}`}
                            className="text-sm font-medium text-neutral-700 dark:text-neutral-700 truncate block hover:text-accent-600 hover:underline"
                          >
                            {c.name}
                          </Link>
                          {c.annualValue !== null && (
                            <p className="text-[11px] tabular-nums text-neutral-400">
                              {formatIDRCompact(c.annualValue)}/tahun
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-medium tabular-nums ${urgencyColor}`}>
                            {days !== null ? `${days}h` : "—"}
                          </p>
                          <p className="text-[10px] text-neutral-400">lagi</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Drill-down Sheet — full screen on mobile */}
      <Sheet
        open={activeDrawer !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:w-[600px] sm:max-w-[600px] flex flex-col p-0 bg-white dark:bg-card"
        >
          <SheetHeader className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-100">
            <SheetTitle className="dark:text-neutral-700">{drawerMeta.title}</SheetTitle>
            <SheetDescription className="text-xs text-neutral-400">
              {drawerMeta.description}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {renderDrawerContent()}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
