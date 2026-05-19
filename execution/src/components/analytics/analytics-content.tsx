"use client"

import { useState } from "react"
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
import { formatIDR } from "@/lib/utils"
import type {
  WinRateByAE,
  WinRateByIndustry,
  RevenueTrendPoint,
  FunnelStage,
  ClientRetention,
} from "@/app/(dashboard)/analytics/page"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsContentProps {
  winRateByAE: WinRateByAE[]
  winRateByIndustry: WinRateByIndustry[]
  revenueTrend: RevenueTrendPoint[]
  pipelineFunnel: FunnelStage[]
  clientRetention: ClientRetention
  aePerformance: WinRateByAE[]
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
}: AnalyticsContentProps) {
  const [winRateTab, setWinRateTab] = useState<"ae" | "industry">("ae")

  // Bar chart height scales with number of data rows — min 200px
  const aeChartHeight = Math.max(200, winRateByAE.length * 40)
  const industryChartHeight = Math.max(200, winRateByIndustry.length * 40)
  const funnelChartHeight = Math.max(200, pipelineFunnel.length * 40)

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
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
