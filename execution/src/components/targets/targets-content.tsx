"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { SerializedTarget } from "@/app/(dashboard)/targets/page"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TargetsContentProps {
  allTargets: SerializedTarget[]
  currentMonthTarget: SerializedTarget | null
  currentQuarterTarget: SerializedTarget | null
  monthlyActual: { revenue: number; newClients: number }
  quarterlyActual: { revenue: number; newClients: number }
  currentMonth: number
  currentYear: number
  currentQuarter: number
}

type ViewMode = "monthly" | "quarterly"
type TargetFormType = "monthly" | "quarterly"

interface TargetFormState {
  formType: TargetFormType
  periodMonth: string   // month 1-12 (monthly) or quarter 1-4 (quarterly)
  periodYear: string
  revenueTarget: string
  newClientTarget: string
  editingId: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function formatPeriod(t: SerializedTarget): string {
  if (t.type === "quarterly") return `Q${t.periodMonth} ${t.periodYear}`
  return `${MONTH_SHORT[t.periodMonth - 1]} ${t.periodYear}`
}

function progressPct(actual: number, target: number): number {
  if (target <= 0) return 0
  return Math.round((actual / target) * 100)
}

function progressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 75) return "bg-blue-500"
  if (pct >= 50) return "bg-amber-500"
  return "bg-red-400"
}

function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

const INITIAL_FORM: TargetFormState = {
  formType: "monthly",
  periodMonth: "1",
  periodYear: new Date().getFullYear().toString(),
  revenueTarget: "",
  newClientTarget: "0",
  editingId: null,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TargetsContent({
  allTargets: initialTargets,
  currentMonthTarget,
  currentQuarterTarget,
  monthlyActual,
  quarterlyActual,
  currentMonth,
  currentYear,
  currentQuarter,
}: TargetsContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [targets, setTargets] = useState<SerializedTarget[]>(initialTargets)
  const [form, setForm] = useState<TargetFormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Current period data derived from local state (so optimistic updates reflect immediately)
  const localMonthTarget = targets.find(
    (t) => t.type === "monthly" && t.periodMonth === currentMonth && t.periodYear === currentYear
  ) ?? currentMonthTarget
  const localQuarterTarget = targets.find(
    (t) => t.type === "quarterly" && t.periodMonth === currentQuarter && t.periodYear === currentYear
  ) ?? currentQuarterTarget

  const activePeriodTarget = viewMode === "monthly" ? localMonthTarget : localQuarterTarget
  const activeActual = viewMode === "monthly" ? monthlyActual : quarterlyActual

  const activePeriodLabel =
    viewMode === "monthly"
      ? `${MONTH_SHORT[currentMonth - 1]} ${currentYear}`
      : `Q${currentQuarter} ${currentYear}`

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEditTarget(t: SerializedTarget) {
    setForm({
      formType: t.type,
      periodMonth: String(t.periodMonth),
      periodYear: String(t.periodYear),
      revenueTarget: String(t.revenueTarget),
      newClientTarget: String(t.newClientTarget),
      editingId: t.id,
    })
    setSaveError(null)
  }

  function handleCancelEdit() {
    setForm(INITIAL_FORM)
    setSaveError(null)
  }

  async function handleDeleteTarget(id: string) {
    try {
      const res = await fetch(`/api/targets/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        console.error("[DELETE /api/targets]", res.status)
        return
      }
      setTargets((prev) => prev.filter((t) => t.id !== id))
      if (form.editingId === id) setForm(INITIAL_FORM)
    } catch (err) {
      console.error("[DELETE /api/targets]", err)
    }
  }

  async function handleSave() {
    setSaveError(null)
    const periodMonth = parseInt(form.periodMonth, 10)
    const periodYear = parseInt(form.periodYear, 10)
    const revenueTarget = parseFloat(form.revenueTarget)
    const newClientTarget = parseInt(form.newClientTarget, 10)

    if (isNaN(periodMonth) || isNaN(periodYear)) {
      setSaveError("Period is required.")
      return
    }
    if (isNaN(revenueTarget) || revenueTarget < 0) {
      setSaveError("Revenue target must be a valid non-negative number.")
      return
    }

    setSaving(true)
    try {
      if (form.editingId) {
        // PATCH existing target
        const res = await fetch(`/api/targets/${form.editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revenueTarget, newClientTarget }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          setSaveError(data.error ?? "Failed to update target.")
          return
        }
        const data = (await res.json()) as { target: SerializedTarget }
        setTargets((prev) =>
          prev.map((t) => (t.id === form.editingId ? data.target : t))
        )
      } else {
        // POST upsert
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodMonth,
            periodYear,
            revenueTarget,
            newClientTarget: isNaN(newClientTarget) ? 0 : newClientTarget,
            type: form.formType,
          }),
        })
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          setSaveError(data.error ?? "Failed to save target.")
          return
        }
        const data = (await res.json()) as { target: SerializedTarget }
        // Upsert: replace existing or add new
        setTargets((prev) => {
          const idx = prev.findIndex((t) => t.id === data.target.id)
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = data.target
            return updated
          }
          // Insert and re-sort: most recent first
          return [data.target, ...prev].sort((a, b) => {
            if (b.periodYear !== a.periodYear) return b.periodYear - a.periodYear
            return b.periodMonth - a.periodMonth
          })
        })
      }
      setForm(INITIAL_FORM)
    } catch (err) {
      console.error("[handleSave]", err)
      setSaveError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ── Revenue target input: format on blur, raw value on focus ──────────────

  function handleRevenueBlur() {
    const n = parseFloat(form.revenueTarget)
    if (!isNaN(n)) {
      setForm((f) => ({ ...f, revenueTarget: n.toFixed(0) }))
    }
  }

  // ── Progress bar ─────────────────────────────────────────────────────────

  function ProgressBar({ actual, target, label }: { actual: number; target: number; label: string }) {
    const pct = progressPct(actual, target)
    const color = progressColor(pct)
    const displayPct = pct

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 text-sm">
          <span className="font-medium text-neutral-700">{label}</span>
          {label === "Revenue" ? (
            <span className="text-neutral-500">
              {formatIDR(actual)} / {formatIDR(target)} ({displayPct}%)
            </span>
          ) : (
            <span className="text-neutral-500">
              {actual} / {target} clients ({displayPct}%)
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      {/* View mode buttons in page header area */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setViewMode("monthly")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === "monthly"
              ? "bg-neutral-900 text-white"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setViewMode("quarterly")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === "quarterly"
              ? "bg-neutral-900 text-white"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          Quarterly
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Set Target card */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">
              {form.editingId ? "Edit Target" : "Set Target"}
            </h2>

            {/* Tab toggle inside card */}
            <div className="flex rounded-md overflow-hidden border border-neutral-200 mb-4 w-fit">
              <button
                onClick={() => setForm((f) => ({ ...f, formType: "monthly", periodMonth: "1", editingId: null }))}
                disabled={!!form.editingId}
                className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  form.formType === "monthly"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setForm((f) => ({ ...f, formType: "quarterly", periodMonth: "1", editingId: null }))}
                disabled={!!form.editingId}
                className={`px-4 py-1.5 text-sm font-medium border-l border-neutral-200 transition-colors disabled:cursor-not-allowed ${
                  form.formType === "quarterly"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Quarterly
              </button>
            </div>

            <div className="space-y-3">
              {/* Period selector row */}
              <div className="grid grid-cols-2 gap-3">
                {form.formType === "monthly" ? (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Month</label>
                    <select
                      value={form.periodMonth}
                      onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
                      disabled={!!form.editingId}
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      {MONTH_SHORT.map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Quarter</label>
                    <select
                      value={form.periodMonth}
                      onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
                      disabled={!!form.editingId}
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="1">Q1 (Jan–Mar)</option>
                      <option value="2">Q2 (Apr–Jun)</option>
                      <option value="3">Q3 (Jul–Sep)</option>
                      <option value="4">Q4 (Oct–Dec)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Year</label>
                  <input
                    type="number"
                    value={form.periodYear}
                    onChange={(e) => setForm((f) => ({ ...f, periodYear: e.target.value }))}
                    disabled={!!form.editingId}
                    min={2020}
                    max={2100}
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </div>
              </div>

              {/* Revenue Target */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Revenue Target (IDR)</label>
                <input
                  type="number"
                  value={form.revenueTarget}
                  onChange={(e) => setForm((f) => ({ ...f, revenueTarget: e.target.value }))}
                  onBlur={handleRevenueBlur}
                  placeholder="e.g. 50000000"
                  min={0}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
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

              {saveError && (
                <p className="text-xs text-red-500">{saveError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || !form.revenueTarget}
                >
                  {saving ? "Saving..." : form.editingId ? "Update Target" : "Save Target"}
                </Button>
                {form.editingId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Target History table */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">Target History</h2>
            {targets.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">No targets set yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="pb-2 text-left text-xs font-medium text-neutral-500">Period</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-500">Revenue Target</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-500">New Clients</th>
                      <th className="pb-2 text-right text-xs font-medium text-neutral-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors ${
                          form.editingId === t.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="py-2.5 font-medium text-neutral-700">
                          <span className="inline-flex items-center gap-1.5">
                            {formatPeriod(t)}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-normal ${
                              t.type === "quarterly"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-blue-50 text-blue-600"
                            }`}>
                              {t.type === "quarterly" ? "Q" : "M"}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-neutral-600">{formatIDR(t.revenueTarget)}</td>
                        <td className="py-2.5 text-right text-neutral-600">{t.newClientTarget}</td>
                        <td className="py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleEditTarget(t)}
                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTarget(t.id)}
                              className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Current Period Achievement */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">
              {activePeriodLabel} — Achievement
            </h2>
            {activePeriodTarget ? (
              <>
                <ProgressBar
                  actual={activeActual.revenue}
                  target={activePeriodTarget.revenueTarget}
                  label="Revenue"
                />
                <ProgressBar
                  actual={activeActual.newClients}
                  target={activePeriodTarget.newClientTarget}
                  label="New Clients"
                />
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                No target set for this period. Use the form to add one.
              </p>
            )}
          </div>

          {/* Overall Progress */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Overall Progress</h2>
            {activePeriodTarget ? (
              <>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-neutral-900">
                    {formatIDR(activeActual.revenue)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor(
                      progressPct(activeActual.revenue, activePeriodTarget.revenueTarget)
                    )}`}
                    style={{
                      width: `${Math.min(
                        progressPct(activeActual.revenue, activePeriodTarget.revenueTarget),
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-neutral-500">
                  {formatIDR(activeActual.revenue)} dari {formatIDR(activePeriodTarget.revenueTarget)} target (
                  {progressPct(activeActual.revenue, activePeriodTarget.revenueTarget)}%) — {activePeriodLabel}
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-400">
                No target set for this period. Use the form to add one.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
