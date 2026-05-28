"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// ---------------------------------------------------------------------------
// Drill-down URL builder — encodes filter conditions for /pipeline
// ---------------------------------------------------------------------------

function buildPipelineUrl(conditions: Array<{ field: string; operator: string; value: string }>): string {
  const encoded = btoa(JSON.stringify(
    conditions.map((c, i) => ({ id: String(i + 1), ...c }))
  ))
  return `/pipeline?filter=${encoded}`
}
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Download, ChevronDown, Check, Loader2 } from "lucide-react"
import { formatIDR } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  WinRateByAE,
  WinRateByIndustry,
  RevenueTrendPoint,
  FunnelStage,
  ClientRetention,
  AEUser,
  OverallWinRate,
  RevenueByProductLine,
} from "@/app/(dashboard)/analytics/page"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatePreset = "all" | "last_week" | "last_month" | "last_3_months" | "custom"

type ModalLead = {
  id: string
  client: { name: string }
  productLine: string | null
  stage: string
  sales: { name: string } | null
  projectedRevenue: number | null
  actualRevenue: number | null
  billingPlan: string | null
}

interface AnalyticsContentProps {
  winRateByAE: WinRateByAE[]
  winRateByIndustry: WinRateByIndustry[]
  revenueTrend: RevenueTrendPoint[]
  pipelineFunnel: FunnelStage[]
  clientRetention: ClientRetention
  aePerformance: WinRateByAE[]
  allAEUsers: AEUser[]
  activeFrom?: string
  activeTo?: string
  activeAeIds?: string
  currentUserRole?: string | null
  overallWinRate: OverallWinRate
  rtYear: number
  revenueByProductLine: RevenueByProductLine[]
}

// ---------------------------------------------------------------------------
// Date preset calculation
// ---------------------------------------------------------------------------

function getPresetDates(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date()

  if (preset === "last_week") {
    // Monday 00:00 → Sunday 23:59:59 of the previous calendar week
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6
    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - daysToLastMonday)
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    return {
      from: toDateString(lastMonday),
      to: toDateString(lastSunday),
    }
  }

  if (preset === "last_month") {
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0) // day 0 = last of prev month
    return {
      from: toDateString(firstOfLastMonth),
      to: toDateString(lastOfLastMonth),
    }
  }

  if (preset === "last_3_months") {
    const firstOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      from: toDateString(firstOf3MonthsAgo),
      to: toDateString(lastOfLastMonth),
    }
  }

  return null
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function detectPreset(from?: string, to?: string): DatePreset {
  if (!from && !to) return "all"
  const preset = (["last_week", "last_month", "last_3_months"] as DatePreset[]).find(
    (p) => {
      const dates = getPresetDates(p)
      return dates && dates.from === from && dates.to === to
    }
  )
  return preset ?? "custom"
}

// ---------------------------------------------------------------------------
// Date range label (used in CSV filename)
// ---------------------------------------------------------------------------

function buildDateRangeLabel(preset: DatePreset, from?: string, to?: string): string {
  if (preset === "all") return "all-time"
  if (preset === "last_week") return "last-week"
  if (preset === "last_month") return "last-month"
  if (preset === "last_3_months") return "last-3-months"
  return `${from ?? "start"}_${to ?? "end"}`
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function formatIDRPlain(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`
}

function exportAEPerformanceCSV(
  data: WinRateByAE[],
  dateRangeLabel: string,
): void {
  const today = toDateString(new Date())
  const filename = `vf-analytics-ae-${dateRangeLabel}-${today}.csv`

  const header = [
    "Busdev/AE",
    "Total Leads",
    "Won",
    "Lost",
    "Win Rate",
    "Total Revenue",
    "Avg Revenue Per Won",
  ].join(",")

  const rows = data.map((row) => {
    const avgRevenue = row.won > 0 ? Math.round(row.revenue / row.won) : 0
    return [
      `"${row.aeName.replace(/"/g, '""')}"`,
      row.total,
      row.won,
      row.lost,
      `${row.winRate}%`,
      `"${formatIDRPlain(row.revenue)}"`,
      `"${formatIDRPlain(avgRevenue)}"`,
    ].join(",")
  })

  const csvContent = [header, ...rows].join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

const PRESET_LABELS: Record<DatePreset, string> = {
  all: "Semua",
  last_week: "Minggu Lalu",
  last_month: "Bulan Lalu",
  last_3_months: "3 Bulan",
  custom: "Custom",
}

interface FilterBarProps {
  allAEUsers: AEUser[]
  activeFrom?: string
  activeTo?: string
  activeAeIds?: string
  currentUserRole?: string | null
}

function FilterBar({ allAEUsers, activeFrom, activeTo, activeAeIds, currentUserRole }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPreset = detectPreset(activeFrom, activeTo)
  const selectedAeIds = activeAeIds
    ? activeAeIds.split(",").map((s) => s.trim()).filter(Boolean)
    : []

  const [customFrom, setCustomFrom] = useState(
    currentPreset === "custom" ? (activeFrom ?? "") : ""
  )
  const [customTo, setCustomTo] = useState(
    currentPreset === "custom" ? (activeTo ?? "") : ""
  )
  const [aeOpen, setAeOpen] = useState(false)

  const pushParams = useCallback(
    (from: string | null, to: string | null, aeIds: string[]) => {
      const params = new URLSearchParams(searchParams.toString())

      if (from) params.set("from", from)
      else params.delete("from")

      if (to) params.set("to", to)
      else params.delete("to")

      if (aeIds.length > 0) params.set("aeIds", aeIds.join(","))
      else params.delete("aeIds")

      router.replace(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  function handlePreset(preset: DatePreset) {
    if (preset === "all") {
      setCustomFrom("")
      setCustomTo("")
      pushParams(null, null, selectedAeIds)
      return
    }
    if (preset === "custom") {
      // Stay on custom — don't push until user picks dates
      return
    }
    const dates = getPresetDates(preset)
    if (dates) {
      setCustomFrom("")
      setCustomTo("")
      pushParams(dates.from, dates.to, selectedAeIds)
    }
  }

  function handleCustomApply() {
    if (!customFrom || !customTo) return
    // Clamp to max 3 years
    const from = new Date(customFrom)
    const to = new Date(customTo)
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) return
    if (diffDays > 365 * 3) {
      // Cap to at 3 years from start
      const capped = new Date(from)
      capped.setFullYear(from.getFullYear() + 3)
      pushParams(customFrom, toDateString(capped), selectedAeIds)
    } else {
      pushParams(customFrom, customTo, selectedAeIds)
    }
  }

  function toggleAE(id: string) {
    const next = selectedAeIds.includes(id)
      ? selectedAeIds.filter((x) => x !== id)
      : [...selectedAeIds, id]
    const from = activeFrom ?? null
    const to = activeTo ?? null
    pushParams(from, to, next)
  }

  function clearAE() {
    pushParams(activeFrom ?? null, activeTo ?? null, [])
    setAeOpen(false)
  }

  const presets: DatePreset[] = ["all", "last_week", "last_month", "last_3_months", "custom"]

  return (
    <div className="flex flex-wrap items-center gap-3 px-8 pt-5 pb-1">
      {/* Preset tabs */}
      <div className="flex rounded-md overflow-hidden border border-neutral-200 text-xs shrink-0">
        {presets.map((preset, i) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={[
              "px-3 py-1.5 transition-colors",
              i > 0 ? "border-l border-neutral-200" : "",
              currentPreset === preset
                ? "bg-neutral-800 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50",
            ].join(" ")}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      {/* Custom date inputs — shown when custom is active */}
      {currentPreset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-7 text-xs w-36"
            max={customTo || undefined}
          />
          <span className="text-xs text-neutral-400">–</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-7 text-xs w-36"
            min={customFrom || undefined}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
          >
            Terapkan
          </Button>
        </div>
      )}

      {/* AE multi-select popover — hidden for account role (filter is forced to own ID) */}
      {allAEUsers.length > 0 && currentUserRole !== "account" && (
        <Popover open={aeOpen} onOpenChange={setAeOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 transition-colors shrink-0">
              {selectedAeIds.length > 0 ? (
                <span className="text-neutral-800 font-medium">
                  Busdev/AE: {selectedAeIds.length} dipilih
                </span>
              ) : (
                <span>Busdev/AE</span>
              )}
              <ChevronDown className="h-3 w-3 text-neutral-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {allAEUsers.map((ae) => {
                const selected = selectedAeIds.includes(ae.id)
                return (
                  <button
                    key={ae.id}
                    onClick={() => toggleAE(ae.id)}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <span>{ae.name}</span>
                    {selected && <Check className="h-3 w-3 text-blue-600" />}
                  </button>
                )
              })}
            </div>
            {selectedAeIds.length > 0 && (
              <div className="mt-2 pt-2 border-t border-neutral-100">
                <button
                  onClick={clearAE}
                  className="w-full text-xs text-neutral-400 hover:text-neutral-600 transition-colors text-left px-2"
                >
                  Hapus filter
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tooltip components (Recharts requires stable components — no inline lambdas)
// ---------------------------------------------------------------------------

interface WinRatePayload {
  won: number
  total: number
  winRate: number
}

interface WinRateTooltipProps {
  active?: boolean
  payload?: Array<{ payload: WinRatePayload }>
  label?: string
}

function WinRateTooltip({ active, payload, label }: WinRateTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-neutral-800 mb-1">{label}</p>
      <p className="text-neutral-500">Won: <span className="text-neutral-800 font-medium">{data.won}</span></p>
      <p className="text-neutral-500">Total: <span className="text-neutral-800 font-medium">{data.total}</span></p>
      <p className="text-neutral-500">Win Rate: <span className="text-blue-600 font-medium">{data.winRate}%</span></p>
    </div>
  )
}

interface RevenueTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const won = payload.find((p) => p.dataKey === "won")
  const active_ = payload.find((p) => p.dataKey === "active")
  const potential = payload.find((p) => p.dataKey === "potential")
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-neutral-800 mb-1">{label}</p>
      {won && (
        <p className="text-neutral-500">Won: <span className="text-emerald-600 font-medium">{formatIDR(won.value)}</span></p>
      )}
      {active_ && (
        <p className="text-neutral-500">Active Pipeline: <span className="text-blue-600 font-medium">{formatIDR(active_.value)}</span></p>
      )}
      {potential && (
        <p className="text-neutral-500">Potential: <span className="text-neutral-500 font-medium">{formatIDR(potential.value)}</span></p>
      )}
    </div>
  )
}

interface FunnelPayload {
  value: number
  payload: { conversionRate?: number | null }
}

interface FunnelTooltipProps {
  active?: boolean
  payload?: Array<FunnelPayload>
  label?: string
}

function FunnelTooltip({ active, payload, label }: FunnelTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-neutral-800 mb-1">{label}</p>
      <p className="text-neutral-500">Leads: <span className="text-neutral-800 font-medium">{payload[0].value}</span></p>
      {data.conversionRate !== null && data.conversionRate !== undefined && (
        <p className="text-neutral-500">From prev: <span className="text-indigo-600 font-medium">{data.conversionRate}%</span></p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revenue Y-axis tick formatter
// ---------------------------------------------------------------------------

function formatRevenueTick(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

// ---------------------------------------------------------------------------
// Product line label map
// ---------------------------------------------------------------------------

const PRODUCT_LINE_LABELS: Record<string, string> = {
  stracomm: "Stracomm",
  smm: "SMM",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Mgmt",
  production: "Production",
  others: "Others",
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnalyticsContent({
  winRateByAE,
  winRateByIndustry,
  revenueTrend,
  pipelineFunnel,
  clientRetention,
  aePerformance,
  allAEUsers,
  activeFrom,
  activeTo,
  activeAeIds,
  currentUserRole,
  overallWinRate,
  rtYear,
  revenueByProductLine,
}: AnalyticsContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [winRateTab, setWinRateTab] = useState<"ae" | "industry">("ae")

  const [funnelModal, setFunnelModal] = useState<{
    open: boolean
    stage: string
    label: string
    count: number
  } | null>(null)
  const [modalLeads, setModalLeads] = useState<ModalLead[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  const currentPreset = detectPreset(activeFrom, activeTo)
  const dateRangeLabel = buildDateRangeLabel(currentPreset, activeFrom, activeTo)

  // Bar chart height scales with number of data rows — min 200px
  const aeChartHeight = Math.max(200, winRateByAE.length * 40)
  const industryChartHeight = Math.max(200, winRateByIndustry.length * 40)
  const funnelChartHeight = Math.max(200, pipelineFunnel.length * 40)

  function handleExport() {
    exportAEPerformanceCSV(aePerformance, dateRangeLabel)
  }

  function handleAEClick(data: WinRateByAE) {
    if (!data.aeId) return
    router.push(buildPipelineUrl([{ field: "salesId", operator: "is", value: data.aeId }]))
  }

  async function handleFunnelClick(data: FunnelStage) {
    setFunnelModal({ open: true, stage: data.stage, label: data.label, count: data.count })
    setModalLoading(true)
    setModalLeads([])
    const p = new URLSearchParams({ stage: data.stage })
    const selectedAeArr = activeAeIds
      ? activeAeIds.split(",").map((s) => s.trim()).filter(Boolean)
      : []
    if (selectedAeArr.length === 1) p.set("salesId", selectedAeArr[0])
    try {
      const res = await fetch(`/api/leads?${p.toString()}`)
      const json = await res.json() as { leads?: ModalLead[] }
      setModalLeads(json.leads ?? [])
    } catch {
      setModalLeads([])
    } finally {
      setModalLoading(false)
    }
  }

  const WON_STAGES_MODAL = new Set(["closed_won", "invoiced", "contract_renewal"])
  function getModalRevenue(lead: ModalLead): number | null {
    return WON_STAGES_MODAL.has(lead.stage) ? lead.actualRevenue : lead.projectedRevenue
  }

  return (
    <>
      <FilterBar
        allAEUsers={allAEUsers}
        activeFrom={activeFrom}
        activeTo={activeTo}
        activeAeIds={activeAeIds}
        currentUserRole={currentUserRole}
      />

      <main className="flex-1 overflow-y-auto px-8 py-4">
        {/* Export button row */}
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={aePerformance.length === 0}
          >
            <Download className="h-4 w-4" />
            Export AE CSV
          </Button>
        </div>

        {/* Row 1: Win Rate + Revenue Trend */}
        <div className="grid grid-cols-2 gap-6 mb-6">

          {/* Win Rate card with By AE / By Industry tab */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-neutral-500">Win Rate</h3>
              <div className="flex rounded-md overflow-hidden border border-neutral-200 text-xs">
                <button
                  onClick={() => setWinRateTab("ae")}
                  className={`px-3 py-1 transition-colors ${
                    winRateTab === "ae"
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  By AE
                </button>
                <button
                  onClick={() => setWinRateTab("industry")}
                  className={`px-3 py-1 transition-colors border-l border-neutral-200 ${
                    winRateTab === "industry"
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  By Industry
                </button>
              </div>
            </div>

            {winRateTab === "ae" ? (
              winRateByAE.length === 0 ? (
                <EmptyState label="No AE data" />
              ) : (
                <ResponsiveContainer width="100%" height={aeChartHeight}>
                  <BarChart
                    data={winRateByAE}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="aeName"
                      tick={{ fontSize: 12, fill: "#374151" }}
                      axisLine={false}
                      tickLine={false}
                      width={96}
                    />
                    <Tooltip content={<WinRateTooltip />} cursor={{ fill: "#f9fafb" }} />
                    <Bar
                      dataKey="winRate"
                      fill="#3B82F6"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={20}
                      onClick={(data) => handleAEClick(data as unknown as WinRateByAE)}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              winRateByIndustry.length === 0 ? (
                <EmptyState label="No industry data" />
              ) : (
                <ResponsiveContainer width="100%" height={industryChartHeight}>
                  <BarChart
                    data={winRateByIndustry}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="industry"
                      tick={{ fontSize: 12, fill: "#374151" }}
                      axisLine={false}
                      tickLine={false}
                      width={96}
                    />
                    <Tooltip content={<WinRateTooltip />} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="winRate" fill="#3B82F6" radius={[0, 3, 3, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>

          {/* Revenue Trend */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-neutral-500">Revenue Trend</h3>
                <select
                  value={rtYear}
                  onChange={(e) => {
                    const p = new URLSearchParams(searchParams.toString())
                    p.set("rtYear", e.target.value)
                    router.replace(`?${p.toString()}`)
                  }}
                  className="text-xs border border-neutral-200 rounded px-2 py-0.5 bg-white text-neutral-600 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-emerald-500 rounded" />Won</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />Active Pipeline</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-neutral-400 rounded border-dashed" style={{borderTop: '2px dashed #9CA3AF', background: 'transparent', height: 0}} />Potential</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={revenueTrend}
                margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatRevenueTick}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#e5e7eb" }} />
                <Line
                  type="monotone"
                  dataKey="won"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#10B981", strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="active"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#3B82F6", strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="potential"
                  stroke="#9CA3AF"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={{ r: 2, fill: "#9CA3AF", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "#9CA3AF", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Product Line */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card mb-6">
          <h3 className="text-sm font-semibold text-neutral-800 mb-4">Revenue by Product Line</h3>
          {revenueByProductLine.length === 0 ? (
            <p className="text-sm text-neutral-400 py-8 text-center">No won revenue data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={revenueByProductLine.map((r) => ({
                  name: PRODUCT_LINE_LABELS[r.productLine] ?? r.productLine,
                  revenue: r.revenue,
                }))}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatIDR(typeof value === "number" ? value : 0), "Revenue"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Row 2: Pipeline Funnel + Client Retention + AE Performance + Overall Win/Loss Rate */}
        <div className="grid grid-cols-4 gap-6">

          {/* Pipeline Funnel */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="text-sm font-medium text-neutral-500 mb-4">Pipeline Funnel</h3>
            {pipelineFunnel.every((s) => s.count === 0) ? (
              <EmptyState label="No pipeline data" />
            ) : (
              <ResponsiveContainer width="100%" height={funnelChartHeight}>
                <BarChart
                  data={pipelineFunnel}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#374151" }}
                    axisLine={false}
                    tickLine={false}
                    width={104}
                  />
                  <Tooltip content={<FunnelTooltip />} cursor={{ fill: "#f9fafb" }} />
                  <Bar
                    dataKey="count"
                    fill="#6366F1"
                    radius={[0, 3, 3, 0]}
                    maxBarSize={16}
                    onClick={(data) => handleFunnelClick(data as unknown as FunnelStage)}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Client Retention */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card flex flex-col">
            <h3 className="text-sm font-medium text-neutral-500 mb-4">Client Retention</h3>
            <div className="flex flex-col flex-1 gap-3 py-2">
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-100">
                <span className="text-xs text-neutral-500">Contract Renewals</span>
                <span className="text-sm font-semibold text-neutral-800 tabular-nums">
                  {clientRetention.renewed} klien
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-neutral-100">
                <span className="text-xs text-neutral-500">Upsell Won</span>
                <span className="text-sm font-semibold text-neutral-800 tabular-nums">
                  {clientRetention.upsellWon} klien
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-neutral-500">
                  Renewal Rate dari {clientRetention.total} klien
                </span>
                <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                  {clientRetention.rate}%
                </span>
              </div>
              <RetentionBar rate={clientRetention.rate} />
            </div>
          </div>

          {/* AE Performance Table */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="text-sm font-medium text-neutral-500 mb-4">AE Performance</h3>
            {aePerformance.length === 0 ? (
              <EmptyState label="No AE data" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="pb-2 text-left font-medium text-neutral-400">AE</th>
                      <th className="pb-2 text-right font-medium text-neutral-400">Leads</th>
                      <th className="pb-2 text-right font-medium text-neutral-400">Won</th>
                      <th className="pb-2 text-right font-medium text-neutral-400">Rate</th>
                      <th className="pb-2 text-right font-medium text-neutral-400">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aePerformance.map((row) => (
                      <tr
                        key={row.aeName}
                        className="border-b border-neutral-50 last:border-0"
                      >
                        <td className="py-2 text-neutral-800 font-medium truncate max-w-[80px]">
                          {row.aeName}
                        </td>
                        <td className="py-2 text-right text-neutral-600 tabular-nums">
                          {row.total}
                        </td>
                        <td className="py-2 text-right text-neutral-600 tabular-nums">
                          {row.won}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          <span
                            className={
                              row.winRate >= 50
                                ? "text-emerald-600 font-medium"
                                : row.winRate >= 25
                                ? "text-amber-600 font-medium"
                                : "text-red-500 font-medium"
                            }
                          >
                            {row.winRate}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-neutral-800 font-medium tabular-nums">
                          {formatIDR(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Overall Win/Loss Rate */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h3 className="text-sm font-medium text-neutral-500 mb-3">Overall Win/Loss Rate</h3>
            <div className="space-y-3">
              <div>
                <p className="text-3xl font-bold text-neutral-900">{overallWinRate.winLossRate}%</p>
                <p className="text-xs text-neutral-500 mt-1">Loss rate vs total pitched</p>
              </div>
              <div className="pt-2 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-neutral-500">Lost Deals</p>
                  <p className="font-semibold text-danger-600">{overallWinRate.lost}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Total Pitched</p>
                  <p className="font-semibold text-neutral-800">{overallWinRate.denominator}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Funnel Stage Drill-down Modal */}
      <Dialog
        open={funnelModal?.open ?? false}
        onOpenChange={(open) => { if (!open) setFunnelModal(null) }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {funnelModal?.label} — {funnelModal?.count} projects
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {modalLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              </div>
            ) : modalLeads.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-12">No projects in this stage</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="pb-2 text-left font-medium text-neutral-400 pr-3">Company</th>
                    <th className="pb-2 text-left font-medium text-neutral-400 pr-3">Product Line</th>
                    <th className="pb-2 text-left font-medium text-neutral-400 pr-3">AE</th>
                    <th className="pb-2 text-left font-medium text-neutral-400 pr-3">Billing Plan</th>
                    <th className="pb-2 text-right font-medium text-neutral-400">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {modalLeads.map((lead) => {
                    const rev = getModalRevenue(lead)
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => window.open(`/pipeline/${lead.id}`, "_blank")}
                      >
                        <td className="py-2 pr-3 text-neutral-800 font-medium">{lead.client.name}</td>
                        <td className="py-2 pr-3 text-neutral-600">{lead.productLine ?? "—"}</td>
                        <td className="py-2 pr-3 text-neutral-600">{lead.sales?.name ?? "—"}</td>
                        <td className="py-2 pr-3 text-neutral-600">{lead.billingPlan ?? "—"}</td>
                        <td className="py-2 text-right text-neutral-800 font-medium tabular-nums">
                          {rev != null ? formatIDR(rev) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-neutral-400">
      {label}
    </div>
  )
}

function RetentionBar({ rate }: { rate: number }) {
  return (
    <div className="w-full max-w-[160px] mt-2">
      <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  )
}
