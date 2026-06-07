"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight, Lock, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { QuarterData, AeOption } from "@/app/(dashboard)/targets/page"

// ── Types ─────────────────────────────────────────────────────────────────────

interface TargetsContentProps {
  quarters: QuarterData[]
  annualTarget: number
  annualActual: number
  year: number
  aeOptions: AeOption[]
  selectedAeId: string | null
  userRole: string | null
}

interface EditForm {
  quarter: string
  year: string
  revenueTarget: string
  newClientTarget: string
  editingId: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const QUARTER_MONTHS: Record<number, string> = {
  1: "Jan–Mar", 2: "Apr–Jun", 3: "Jul–Sep", 4: "Oct–Dec",
}

function formatIDR(n: number): string {
  if (n === 0) return "Rp 0"
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}M`
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

function pct(actual: number, target: number): number {
  if (target <= 0) return 0
  return Math.round((actual / target) * 100)
}

function gapColor(gap: number): string {
  return gap >= 0 ? "text-emerald-600" : "text-danger-600"
}

function makeInitialForm(year: number): EditForm {
  return {
    quarter: "1",
    year: String(year),
    revenueTarget: "",
    newClientTarget: "0",
    editingId: null,
  }
}

// ── Annual KPI Card ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color ?? "text-neutral-900"}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Stacked bar: actual (solid) + forecast (lighter amber), both relative to target
function ForecastBar({ actual, forecast, max }: { actual: number; forecast: number; max: number }) {
  if (max <= 0) return null
  const actualPct = Math.min((actual / max) * 100, 100)
  const forecastPct = Math.min((forecast / max) * 100, 100 - actualPct)
  return (
    <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden mt-1 flex">
      <div className="h-full bg-blue-500 transition-all" style={{ width: `${actualPct}%` }} />
      {forecastPct > 0 && (
        <div className="h-full bg-amber-300 transition-all" style={{ width: `${forecastPct}%` }} />
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TargetsContent({
  quarters,
  annualTarget: _annualTarget, // eslint-disable-line @typescript-eslint/no-unused-vars
  annualActual,
  year,
  aeOptions,
  selectedAeId,
  userRole,
}: TargetsContentProps) {
  const isAdmin = userRole === "admin" || userRole === "commercial_director"
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [form, setForm] = useState<EditForm>(() => makeInitialForm(year))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expandedQ, setExpandedQ] = useState<number | null>(null)
  const [localQuarters, setLocalQuarters] = useState<QuarterData[]>(quarters)

  const selectedAeName = selectedAeId
    ? (aeOptions.find((a) => a.id === selectedAeId)?.name ?? "AE")
    : "Company"

  const localAnnualTarget = localQuarters.reduce((sum, q) => sum + q.revenueTarget, 0)
  const annualGap = annualActual - localAnnualTarget
  const annualPct = pct(annualActual, localAnnualTarget)

  // AE selector
  function handleAeChange(aeId: string) {
    const url = new URL(window.location.href)
    if (aeId === "") url.searchParams.delete("aeId")
    else url.searchParams.set("aeId", aeId)
    startTransition(() => router.replace(url.pathname + url.search))
  }

  // Year selector
  function handleYearChange(y: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.set("year", y)
    startTransition(() => router.replace(`?${p.toString()}`))
  }

  // Edit existing target
  function handleEdit(q: QuarterData) {
    if (!q.targetId) return
    setForm({
      quarter: String(q.quarter),
      year: String(year),
      revenueTarget: String(q.revenueTarget),
      newClientTarget: String(q.newClientTarget),
      editingId: q.targetId,
    })
    setSaveError(null)
  }

  function handleCancel() {
    setForm(makeInitialForm(year))
    setSaveError(null)
  }

  // Delete target
  async function handleDelete(q: QuarterData) {
    if (!q.targetId) return
    try {
      const res = await fetch(`/api/targets/${q.targetId}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) return
      setLocalQuarters((prev) => prev.map((lq) =>
        lq.quarter === q.quarter
          ? { ...lq, targetId: null, revenueTarget: 0, newClientTarget: 0 }
          : lq
      ))
      if (form.editingId === q.targetId) setForm(makeInitialForm(year))
    } catch (err) {
      console.error("[DELETE /api/targets]", err)
    }
  }

  // Save target
  async function handleSave() {
    setSaveError(null)
    const qNum = parseInt(form.quarter, 10)
    const yearNum = parseInt(form.year, 10)
    const revenue = parseFloat(form.revenueTarget)
    const nc = parseInt(form.newClientTarget, 10) || 0

    if (isNaN(qNum) || qNum < 1 || qNum > 4) { setSaveError("Pilih kuartal."); return }
    if (isNaN(revenue) || revenue < 0) { setSaveError("Revenue target harus angka positif."); return }

    setSaving(true)
    try {
      if (form.editingId) {
        // PATCH existing
        const res = await fetch(`/api/targets/${form.editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revenueTarget: revenue, newClientTarget: nc }),
        })
        if (!res.ok) {
          const d = await res.json() as { error?: string }
          setSaveError(d.error ?? "Gagal update target.")
          return
        }
        setLocalQuarters((prev) => prev.map((lq) =>
          lq.quarter === qNum
            ? { ...lq, revenueTarget: revenue, newClientTarget: nc }
            : lq
        ))
        setForm(makeInitialForm(year))
      } else {
        // POST new
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodMonth: qNum,
            periodYear: yearNum,
            revenueTarget: revenue,
            newClientTarget: nc,
            type: "quarterly",
            salesId: selectedAeId,
          }),
        })
        if (!res.ok) {
          const d = await res.json() as { error?: string }
          setSaveError(d.error ?? "Gagal simpan target.")
          return
        }
        const data = await res.json() as { target: { id: string; revenueTarget: number; newClientTarget: number } }
        setLocalQuarters((prev) => prev.map((lq) =>
          lq.quarter === qNum
            ? { ...lq, targetId: data.target.id, revenueTarget: data.target.revenueTarget, newClientTarget: data.target.newClientTarget }
            : lq
        ))
        setForm(makeInitialForm(year))
      }
    } catch {
      setSaveError("Network error. Coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      {/* Selectors */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-xs font-medium text-neutral-500 shrink-0">View targets for:</label>
        <select
          value={selectedAeId ?? ""}
          onChange={(e) => handleAeChange(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          <option value="">Company (Company-wide)</option>
          {aeOptions.map((ae) => (
            <option key={ae.id} value={ae.id}>{ae.name}</option>
          ))}
        </select>
        {selectedAeId && (
          <span className="text-xs text-neutral-400">Showing: {selectedAeName}</span>
        )}
        <select
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          className="text-xs border border-neutral-200 rounded px-2 py-0.5 bg-white text-neutral-600 focus:outline-none ml-auto"
        >
          {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Annual Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Annual Target"
          value={formatIDR(localAnnualTarget)}
          sub={`${year} — sum Q1–Q4`}
        />
        <KpiCard
          label="Annual Actual (YTD)"
          value={formatIDR(annualActual)}
          sub="Won + Invoiced + Renewal"
        />
        <KpiCard
          label="Gap"
          value={`${annualGap >= 0 ? "+" : ""}${formatIDR(annualGap)}`}
          sub="Actual − Target"
          color={annualGap >= 0 ? "text-emerald-600" : "text-danger-600"}
        />
        <KpiCard
          label="Achievement"
          value={`${annualPct}%`}
          sub={localAnnualTarget > 0 ? `${formatIDR(annualActual)} / ${formatIDR(localAnnualTarget)}` : "No target set"}
          color={annualPct >= 100 ? "text-emerald-600" : annualPct >= 75 ? "text-blue-600" : "text-neutral-900"}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left 2 cols: Quarterly Breakdown */}
        <div className="col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-800">Quarterly Breakdown {year}</h2>
          {localQuarters.map((q) => {
            const isExpanded = expandedQ === q.quarter
            const gap = q.actual - q.revenueTarget
            const monthlyTarget = q.revenueTarget > 0 ? q.revenueTarget / 3 : 0

            return (
              <div key={q.quarter} className="rounded-lg border border-neutral-200 bg-white shadow-card overflow-hidden">
                {/* Quarter header row */}
                <div className="px-4 py-3 flex items-center gap-4">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedQ(isExpanded ? null : q.quarter)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {/* Quarter label */}
                  <div className="w-24 shrink-0">
                    <p className="font-semibold text-neutral-800 text-sm">Q{q.quarter} {year}</p>
                    <p className="text-xs text-neutral-400">{QUARTER_MONTHS[q.quarter]}</p>
                  </div>

                  {/* Status badge */}
                  <div className="w-20 shrink-0">
                    {q.status === "closed" && (
                      <span className="inline-flex items-center gap-1 text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    )}
                    {q.status === "active" && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                    {q.status === "future" && (
                      <span className="inline-flex items-center gap-1 text-xs bg-neutral-50 text-neutral-500 px-2 py-0.5 rounded-full font-medium">
                        Future
                      </span>
                    )}
                  </div>

                  {/* Primary number */}
                  <div className="flex-1 min-w-0">
                    {q.status === "closed" ? (
                      <div>
                        <p className="text-base font-bold tabular-nums text-neutral-900">{formatIDR(q.actual)}</p>
                        <p className="text-xs text-neutral-400">
                          Target: {q.revenueTarget > 0 ? formatIDR(q.revenueTarget) : "—"}
                          {q.revenueTarget > 0 && (
                            <span className={`ml-2 font-medium ${gapColor(gap)}`}>
                              {gap >= 0 ? "+" : ""}{formatIDR(gap)}
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-base font-bold tabular-nums text-neutral-900">
                          {q.revenueTarget > 0
                            ? formatIDR(q.revenueTarget)
                            : <span className="text-neutral-400 font-normal text-sm">No target set</span>
                          }
                        </p>
                        {q.status === "active" && (
                          <p className="text-xs text-neutral-400">
                            Actual: {formatIDR(q.actual)}
                            {q.forecast > 0 && (
                              <span className="ml-2 text-amber-600 font-medium">
                                +{formatIDR(q.forecast)} forecast
                              </span>
                            )}
                            {q.revenueTarget > 0 && (
                              <span className={`ml-2 font-medium ${gapColor(q.actual + q.forecast - q.revenueTarget)}`}>
                                ({q.actual + q.forecast - q.revenueTarget >= 0 ? "+" : ""}{formatIDR(q.actual + q.forecast - q.revenueTarget)} proj. gap)
                              </span>
                            )}
                          </p>
                        )}
                        {q.status === "future" && q.forecast > 0 && (
                          <p className="text-xs text-amber-600">
                            {formatIDR(q.forecast)} in pipeline
                          </p>
                        )}
                      </div>
                    )}
                    {q.revenueTarget > 0 && (
                      <ForecastBar actual={q.actual} forecast={q.forecast} max={q.revenueTarget} />
                    )}
                  </div>

                  {/* Actions — admin can edit any quarter including closed */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(q)}
                        disabled={!q.targetId}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {q.targetId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-danger-500 hover:text-danger-700 hover:bg-danger-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus target Q{q.quarter} {year}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ini akan menghapus target revenue {formatIDR(q.revenueTarget)} untuk Q{q.quarter} {year}. Tidak bisa diurungkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-danger-600 hover:bg-danger-700"
                                onClick={() => void handleDelete(q)}
                              >
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {!q.targetId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setForm({ ...makeInitialForm(year), quarter: String(q.quarter) })
                            setSaveError(null)
                          }}
                        >
                          Set target
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Monthly breakdown (collapsible) */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 space-y-2">
                    {/* Legend */}
                    <div className="flex items-center gap-3 pb-1">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <span className="inline-block w-3 h-1.5 rounded-full bg-blue-500" />
                        Actual
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <span className="inline-block w-3 h-1.5 rounded-full bg-amber-300" />
                        Forecast (pipeline)
                      </div>
                    </div>
                    {q.months.map((m) => {
                      const mActual = m.actual
                      const mForecast = m.forecast
                      const mTarget = monthlyTarget
                      const mActualPct = pct(mActual, mTarget)
                      const mCombinedPct = mTarget > 0 ? Math.round(((mActual + mForecast) / mTarget) * 100) : 0
                      return (
                        <div key={m.month} className="flex items-center gap-3">
                          <span className="w-8 text-xs font-medium text-neutral-500 shrink-0">
                            {MONTH_SHORT[m.month - 1]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-neutral-700">
                                {formatIDR(mActual)}
                                {mForecast > 0 && (
                                  <span className="text-amber-600 ml-1">+{formatIDR(mForecast)}</span>
                                )}
                              </span>
                              <span className="text-neutral-400">
                                {mTarget > 0
                                  ? mForecast > 0
                                    ? `/ ${formatIDR(mTarget)} (${mActualPct}% actual, ${mCombinedPct}% w/ forecast)`
                                    : `/ ${formatIDR(mTarget)} (${mActualPct}%)`
                                  : "No target"}
                              </span>
                            </div>
                            {mTarget > 0 && (
                              <ForecastBar actual={mActual} forecast={mForecast} max={mTarget} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right col: Set Target form */}
        <div className="space-y-4">
          {!isAdmin ? (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <p className="text-sm text-neutral-400">Hanya admin yang dapat mengatur target.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <h2 className="text-sm font-semibold text-neutral-800 mb-4">
                {form.editingId ? "Edit Target" : "Set Target Kuartal"}
                {selectedAeId && (
                  <span className="ml-2 text-xs font-normal text-neutral-400">— {selectedAeName}</span>
                )}
              </h2>

              <div className="space-y-3">
                {/* Quarter selector (disabled when editing) */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Kuartal</label>
                  <select
                    value={form.quarter}
                    onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
                    disabled={!!form.editingId}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                  >
                    <option value="1">Q1 (Jan–Mar)</option>
                    <option value="2">Q2 (Apr–Jun)</option>
                    <option value="3">Q3 (Jul–Sep)</option>
                    <option value="4">Q4 (Okt–Des)</option>
                  </select>
                </div>

                {/* Revenue Target */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Revenue Target (IDR)</label>
                  <input
                    type="number"
                    value={form.revenueTarget}
                    onChange={(e) => setForm((f) => ({ ...f, revenueTarget: e.target.value }))}
                    placeholder="e.g. 4000000000"
                    min={0}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  />
                  {form.revenueTarget && !isNaN(parseFloat(form.revenueTarget)) && (
                    <p className="text-xs text-neutral-400 mt-1">
                      ≈ {formatIDR(parseFloat(form.revenueTarget) / 3)}/bulan
                    </p>
                  )}
                </div>

                {/* New Client Target */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">New Client Target</label>
                  <input
                    type="number"
                    value={form.newClientTarget}
                    onChange={(e) => setForm((f) => ({ ...f, newClientTarget: e.target.value }))}
                    placeholder="0"
                    min={0}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  />
                </div>

                {saveError && <p className="text-xs text-danger-600">{saveError}</p>}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => void handleSave()}
                    disabled={saving || !form.revenueTarget}
                  >
                    {saving ? "Saving..." : form.editingId ? "Update Target" : "Save Target"}
                  </Button>
                  {form.editingId && (
                    <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                      Batal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gap context card — shown if any closed quarter has a gap */}
          {localQuarters.some((q) => q.status === "closed" && q.revenueTarget > 0) && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Gap dari Quarter Sebelumnya</p>
              {localQuarters
                .filter((q) => q.status === "closed" && q.revenueTarget > 0)
                .map((q) => {
                  const gap = q.actual - q.revenueTarget
                  return (
                    <div key={q.quarter} className="flex items-center justify-between text-xs mb-1">
                      <span className="text-amber-700">Q{q.quarter}</span>
                      <span className={`font-medium ${gapColor(gap)}`}>
                        {gap >= 0 ? "+" : ""}{formatIDR(gap)}
                      </span>
                    </div>
                  )
                })}
              <p className="text-xs text-amber-600 mt-2 leading-relaxed">
                Pertimbangkan gap ini saat menyesuaikan target Q2–Q4.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
