"use client"

import { useState } from "react"
import Link from "next/link"
import { cn, formatIDR, daysUntil, contractUrgency } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th
                className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none"
                onClick={() => toggleSort("clientName")}
              >
                Client{sortIndicator("clientName")}
              </th>
              <th
                className="text-left text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none"
                onClick={() => toggleSort("stage")}
              >
                Stage{sortIndicator("stage")}
              </th>
              <th
                className="text-right text-xs font-medium text-neutral-400 pb-2 pr-3 cursor-pointer hover:text-neutral-600 select-none"
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
              <tr key={lead.id} className="border-b border-neutral-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-neutral-800">
                  <Link
                    href={`/pipeline/${lead.id}`}
                    className="hover:text-accent-600 hover:underline"
                  >
                    {lead.clientName}
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  <span className="text-xs text-neutral-500">
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-700">
                  {formatIDR(showActual ? lead.actualRevenue : lead.projectedRevenue)}
                </td>
                <td className="py-2.5 text-xs text-neutral-400">
                  {lead.quarter ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
// Props
// ---------------------------------------------------------------------------

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  const pct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-danger-600"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}% vs bulan lalu
    </span>
  )
}

interface DashboardContentProps {
  revenueMTD: number
  revenueMTDPrevMonth: number
  revenueInPipeline: number
  healthyCount: number
  newLeadsCount: number
  revenueTarget: number
  progressPct: number
  currentMonthLabel: string
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
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardContent({
  revenueMTD,
  revenueMTDPrevMonth,
  revenueInPipeline,
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
      default:
        return null
    }
  }

  const drawerMeta =
    activeDrawer !== null ? DRAWER_META[activeDrawer] : { title: "", description: "" }

  return (
    <>
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI strip — 4 cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {/* Card 1 — Revenue Won MTD */}
          <button
            onClick={() => setActiveDrawer("revenue_won")}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card text-left w-full hover:border-accent-200 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
              Revenue Won MTD
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-800 mb-1">
              {formatIDR(revenueMTD)}
            </p>
            {revenueMTDPrevMonth > 0 && (
              <TrendBadge current={revenueMTD} prev={revenueMTDPrevMonth} />
            )}
            <p className="text-xs text-neutral-400">{currentMonthLabel}</p>
          </button>

          {/* Card 2 — Revenue in Pipeline */}
          <button
            onClick={() => setActiveDrawer("pipeline")}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card text-left w-full hover:border-accent-200 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
              Revenue in Pipeline
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-800 mb-1">
              {formatIDR(revenueInPipeline)}
            </p>
            <p className="text-xs text-neutral-400">Across active stages</p>
          </button>

          {/* Card 3 — Healthy Clients */}
          <button
            onClick={() => setActiveDrawer("healthy")}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card text-left w-full hover:border-accent-200 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
              Healthy Clients
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-800 mb-1">
              {healthyCount.toString()}
            </p>
            <p className="text-xs text-neutral-400">Health: healthy</p>
          </button>

          {/* Card 4 — New Leads MTD */}
          <button
            onClick={() => setActiveDrawer("leads_mtd")}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card text-left w-full hover:border-accent-200 hover:shadow-card-hover transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
              New Leads MTD
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-800 mb-1">
              {newLeadsCount.toString()}
            </p>
            <p className="text-xs text-neutral-400">{currentMonthLabel}</p>
          </button>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left col — col-span-2 */}
          <div className="col-span-2 space-y-6">
            {/* Revenue vs Target */}
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-neutral-700">
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
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                      <span>{formatIDR(revenueMTD)}</span>
                      <span>{formatIDR(revenueTarget)}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {progressPct.toFixed(1)}% of target reached
                  </p>
                </>
              )}
            </div>

            {/* Recent Pipeline Activity */}
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <h2 className="text-sm font-semibold text-neutral-700 mb-4">
                Recent Pipeline Activity
              </h2>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-400 py-2">
                  Belum ada aktivitas pipeline.
                </p>
              ) : (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-2.5 border-b border-neutral-100 last:border-0"
                  >
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-accent-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700 truncate">
                        <span className="font-medium">{activity.clientName}</span>
                        {" — "}
                        {STAGE_LABELS[activity.fromStage] ?? activity.fromStage}{" "}
                        &rarr;{" "}
                        {STAGE_LABELS[activity.toStage] ?? activity.toStage}
                      </p>
                      <p className="text-xs text-neutral-400">
                        by {activity.changerName} &middot;{" "}
                        {relativeTime(activity.changedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right col — col-span-1 */}
          <div className="col-span-1 space-y-6">
            {/* Expiring Contracts */}
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <h2 className="text-sm font-semibold text-neutral-700 mb-4">
                Expiring Contracts
              </h2>
              {expiringContracts.length === 0 ? (
                <p className="text-sm text-neutral-400 py-2">
                  Tidak ada kontrak yang akan berakhir dalam 90 hari.
                </p>
              ) : (
                expiringContracts.map((client) => {
                  if (!client.contractEnd) return null
                  const days = daysUntil(client.contractEnd)
                  const urgency = contractUrgency(days)
                  const urgencyClass =
                    urgency === "critical"
                      ? "bg-danger-50 text-danger-700"
                      : urgency === "warning"
                        ? "bg-warning-50 text-warning-700"
                        : "bg-info-50 text-info-700"

                  return (
                    <Link
                      key={client.id}
                      href={`/clients/${client.id}`}
                      className="block mb-2 last:mb-0 rounded-lg bg-neutral-50 p-3 hover:bg-neutral-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-700 truncate">
                          {client.name}
                        </p>
                        <span
                          className={cn(
                            "flex-shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium",
                            urgencyClass
                          )}
                        >
                          {days}d
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Expires{" "}
                        {new Date(client.contractEnd).toLocaleDateString(
                          "id-ID",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                      {(client.monthlyValue || client.annualValue) && (
                        <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                          {client.monthlyValue
                            ? `${formatIDR(client.monthlyValue)}/mo`
                            : client.annualValue
                              ? `${formatIDR(client.annualValue)}/yr`
                              : null}
                        </p>
                      )}
                    </Link>
                  )
                })
              )}
            </div>

            {/* Client Health */}
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <h2 className="text-sm font-semibold text-neutral-700 mb-4">
                Client Health
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveDrawer("healthy")}
                  className="flex-1 rounded-lg bg-success-50 p-3 text-center hover:bg-success-100 transition-colors cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-success-700">
                    {healthyCount}
                  </p>
                  <p className="text-xs text-success-700 mt-0.5">Healthy</p>
                </button>
                <button
                  onClick={() => setActiveDrawer("at_risk")}
                  className="flex-1 rounded-lg bg-warning-50 p-3 text-center hover:bg-warning-100 transition-colors cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-warning-700">
                    {atRiskCount}
                  </p>
                  <p className="text-xs text-warning-700 mt-0.5">At Risk</p>
                </button>
                <button
                  onClick={() => setActiveDrawer("churned")}
                  className="flex-1 rounded-lg bg-danger-50 p-3 text-center hover:bg-danger-100 transition-colors cursor-pointer focus-visible:outline-none"
                >
                  <p className="text-xl font-bold tabular-nums text-danger-700">
                    {churnedCount}
                  </p>
                  <p className="text-xs text-danger-700 mt-0.5">Churned</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Drill-down Sheet */}
      <Sheet
        open={activeDrawer !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDrawer(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-[600px] sm:max-w-[600px] flex flex-col p-0"
        >
          <SheetHeader className="px-6 py-4 border-b border-neutral-200">
            <SheetTitle>{drawerMeta.title}</SheetTitle>
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
