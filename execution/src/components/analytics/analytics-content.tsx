"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Download, ChevronDown, Check } from "lucide-react"
import { formatIDR } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type {
  WinRateByAE,
  WinRateByIndustry,
  RevenueTrendPoint,
  FunnelStage,
  ClientRetention,
  AEUser,
} from "@/app/(dashboard)/analytics/page"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatePreset = "all" | "last_week" | "last_month" | "last_3_months" | "custom"

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
}

function FilterBar({ allAEUsers, activeFrom, activeTo, activeAeIds }: FilterBarProps) {
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

      {/* AE multi-select popover */}
      {allAEUsers.length > 0 && (
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
  payload?: Array<{ value: number }>
  label?: string
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-neutral-800 mb-1">{label}</p>
      <p className="text-neutral-500">Revenue: <span className="text-emerald-600 font-medium">{formatIDR(payload[0].value)}</span></p>
    </div>
  )
}

interface FunnelTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function FunnelTooltip({ active, payload, label }: FunnelTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-neutral-800 mb-1">{label}</p>
      <p className="text-neutral-500">Leads: <span className="text-neutral-800 font-medium">{payload[0].value}</span></p>
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
}: AnalyticsContentProps) {
  const [winRateTab, setWinRateTab] = useState<"ae" | "industry">("ae")

  const currentPreset = detectPreset(activeFrom, activeTo)
  const dateRangeLabel = buildDateRangeLabel(currentPreset, activeFrom, activeTo)

  // Bar chart height scales with number of data rows — min 200px
  const aeChartHeight = Math.max(200, winRateByAE.length * 40)
  const industryChartHeight = Math.max(200, winRateByIndustry.length * 40)
  const funnelChartHeight = Math.max(200, pipelineFunnel.length * 40)

  function handleExport() {
    exportAEPerformanceCSV(aePerformance, dateRangeLabel)
  }

  return (
    <>
      <FilterBar
        allAEUsers={allAEUsers}
        activeFrom={activeFrom}
        activeTo={activeTo}
        activeAeIds={activeAeIds}
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
                    <Bar dataKey="winRate" fill="#3B82F6" radius={[0, 3, 3, 0]} maxBarSize={20} />
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
            <h3 className="text-sm font-medium text-neutral-500 mb-4">Revenue Trend (12 Months)</h3>
            {revenueTrend.every((p) => p.revenue === 0) ? (
              <EmptyState label="No revenue data" />
            ) : (
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
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#10B981", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Row 2: Pipeline Funnel + Client Retention + AE Performance */}
        <div className="grid grid-cols-3 gap-6">

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
                  <Bar dataKey="count" fill="#6366F1" radius={[0, 3, 3, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Client Retention */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card flex flex-col">
            <h3 className="text-sm font-medium text-neutral-500 mb-4">Client Retention</h3>
            <div className="flex flex-col items-center justify-center flex-1 gap-2 py-4">
              <span className="text-6xl font-bold text-neutral-800 tabular-nums leading-none">
                {clientRetention.rate}%
              </span>
              <span className="text-sm text-neutral-500">
                {clientRetention.renewed} dari {clientRetention.total} klien renewed
              </span>
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
        </div>
      </main>
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
