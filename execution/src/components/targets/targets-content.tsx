"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
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
import type { SerializedTarget, AeOption } from "@/app/(dashboard)/targets/page"

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
  aeOptions: AeOption[]
  selectedAeId: string | null
  userRole: string | null
}

// Input mode for the "Set Target" form
type InputMode = "per-bulan" | "per-kuartal" | "setahun-penuh"
type ViewMode = "monthly" | "quarterly"

interface TargetFormState {
  inputMode: InputMode
  periodMonth: string   // month 1-12 (per-bulan) or quarter 1-4 (per-kuartal)
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

const currentYearStr = new Date().getFullYear().toString()

const INITIAL_FORM: TargetFormState = {
  inputMode: "per-bulan",
  periodMonth: "1",
  periodYear: currentYearStr,
  revenueTarget: "",
  newClientTarget: "0",
  editingId: null,
}

// ---------------------------------------------------------------------------
// Sub-component: Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ actual, target, label }: { actual: number; target: number; label: string }) {
  const pct = progressPct(actual, target)
  const color = progressColor(pct)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="font-medium text-neutral-700">{label}</span>
        {label === "Revenue" ? (
          <span className="text-neutral-500">
            {formatIDR(actual)} / {formatIDR(target)} ({pct}%)
          </span>
        ) : (
          <span className="text-neutral-500">
            {actual} / {target} clients ({pct}%)
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
  aeOptions,
  selectedAeId,
  userRole,
}: TargetsContentProps) {
  const isAdmin = userRole === "admin"
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [targets, setTargets] = useState<SerializedTarget[]>(initialTargets)
  const [form, setForm] = useState<TargetFormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Full-year mode: track progress per month (0-11)
  const [fullYearProgress, setFullYearProgress] = useState<string | null>(null)

  // Current period data derived from local state
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

  // AE label for display
  const selectedAeName = selectedAeId
    ? (aeOptions.find((a) => a.id === selectedAeId)?.name ?? "AE")
    : "Company"

  // ── AE selector handler ───────────────────────────────────────────────────

  function handleAeChange(aeId: string) {
    const url = new URL(window.location.href)
    if (aeId === "") {
      url.searchParams.delete("aeId")
    } else {
      url.searchParams.set("aeId", aeId)
    }
    startTransition(() => {
      router.replace(url.pathname + url.search)
    })
  }

  // ── Edit / Cancel / Delete handlers ──────────────────────────────────────

  function handleEditTarget(t: SerializedTarget) {
    // Map DB type back to inputMode — editing always uses per-bulan or per-kuartal
    const inputMode: InputMode = t.type === "quarterly" ? "per-kuartal" : "per-bulan"
    setForm({
      inputMode,
      periodMonth: String(t.periodMonth),
      periodYear: String(t.periodYear),
      revenueTarget: String(t.revenueTarget),
      newClientTarget: String(t.newClientTarget),
      editingId: t.id,
    })
    setSaveError(null)
    setFullYearProgress(null)
  }

  function handleCancelEdit() {
    setForm(INITIAL_FORM)
    setSaveError(null)
    setFullYearProgress(null)
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

  // ── Single-record upsert (per-bulan / per-kuartal / edit) ─────────────────

  async function upsertSingleTarget(payload: {
    periodMonth: number
    periodYear: number
    revenueTarget: number
    newClientTarget: number
    type: "monthly" | "quarterly"
    salesId?: string | null
  }): Promise<SerializedTarget | null> {
    const res = await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, salesId: selectedAeId }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      setSaveError(data.error ?? "Failed to save target.")
      return null
    }
    const data = (await res.json()) as { target: SerializedTarget }
    return data.target
  }

  // ── handleSave (all modes) ────────────────────────────────────────────────

  async function handleSave() {
    setSaveError(null)
    setFullYearProgress(null)

    const periodYear = parseInt(form.periodYear, 10)
    const revenueTarget = parseFloat(form.revenueTarget)
    const newClientTarget = parseInt(form.newClientTarget, 10)

    if (isNaN(periodYear) || periodYear < 2020 || periodYear > 2100) {
      setSaveError("Year is required and must be valid.")
      return
    }
    if (isNaN(revenueTarget) || revenueTarget < 0) {
      setSaveError("Revenue target must be a valid non-negative number.")
      return
    }

    setSaving(true)

    try {
      // ── Edit existing record ───────────────────────────────────────────────
      if (form.editingId) {
        const res = await fetch(`/api/targets/${form.editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revenueTarget,
            newClientTarget: isNaN(newClientTarget) ? 0 : newClientTarget,
          }),
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
        setForm(INITIAL_FORM)
        return
      }

      // ── Per Bulan (single monthly record) ────────────────────────────────
      if (form.inputMode === "per-bulan") {
        const periodMonth = parseInt(form.periodMonth, 10)
        if (isNaN(periodMonth) || periodMonth < 1 || periodMonth > 12) {
          setSaveError("Month is required.")
          return
        }
        const target = await upsertSingleTarget({
          periodMonth,
          periodYear,
          revenueTarget,
          newClientTarget: isNaN(newClientTarget) ? 0 : newClientTarget,
          type: "monthly",
        })
        if (!target) return
        mergeTarget(target)
        setForm(INITIAL_FORM)
        return
      }

      // ── Per Kuartal (single quarterly record) ────────────────────────────
      if (form.inputMode === "per-kuartal") {
        const periodMonth = parseInt(form.periodMonth, 10)
        if (isNaN(periodMonth) || periodMonth < 1 || periodMonth > 4) {
          setSaveError("Quarter is required.")
          return
        }
        const target = await upsertSingleTarget({
          periodMonth,
          periodYear,
          revenueTarget,
          newClientTarget: isNaN(newClientTarget) ? 0 : newClientTarget,
          type: "quarterly",
        })
        if (!target) return
        mergeTarget(target)
        setForm(INITIAL_FORM)
        return
      }

      // ── Setahun Penuh (12 monthly records — annual total ÷ 12 per month) ──
      if (form.inputMode === "setahun-penuh") {
        const revenuePerMonth = Math.round(revenueTarget / 12)
        const nc = isNaN(newClientTarget) ? 0 : newClientTarget
        const ncPerMonth = Math.round(nc / 12)
        const results: SerializedTarget[] = []
        let failed = false

        for (let month = 1; month <= 12; month++) {
          setFullYearProgress(`Saving ${MONTH_SHORT[month - 1]} ${periodYear}...`)
          const target = await upsertSingleTarget({
            periodMonth: month,
            periodYear,
            revenueTarget: revenuePerMonth,
            newClientTarget: ncPerMonth,
            type: "monthly",
          })
          if (!target) {
            failed = true
            break
          }
          results.push(target)
        }

        setFullYearProgress(null)

        if (!failed) {
          setTargets((prev) => {
            let updated = [...prev]
            for (const t of results) {
              const idx = updated.findIndex((x) => x.id === t.id)
              if (idx !== -1) {
                updated[idx] = t
              } else {
                updated = [t, ...updated]
              }
            }
            return updated.sort((a, b) => {
              if (b.periodYear !== a.periodYear) return b.periodYear - a.periodYear
              return b.periodMonth - a.periodMonth
            })
          })
          setForm(INITIAL_FORM)
        }
      }
    } catch (err) {
      console.error("[handleSave]", err)
      setSaveError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // Merge a single target into local state (upsert by id or prepend)
  function mergeTarget(t: SerializedTarget) {
    setTargets((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = t
        return updated
      }
      return [t, ...prev].sort((a, b) => {
        if (b.periodYear !== a.periodYear) return b.periodYear - a.periodYear
        return b.periodMonth - a.periodMonth
      })
    })
  }

  // ── Revenue blur formatting ───────────────────────────────────────────────

  function handleRevenueBlur() {
    const n = parseFloat(form.revenueTarget)
    if (!isNaN(n)) {
      setForm((f) => ({ ...f, revenueTarget: n.toFixed(0) }))
    }
  }

  // ── Tab switch ────────────────────────────────────────────────────────────

  function switchInputMode(mode: InputMode) {
    if (form.editingId) return // locked during edit
    setForm((f) => ({
      ...f,
      inputMode: mode,
      periodMonth: "1",
      editingId: null,
    }))
    setSaveError(null)
    setFullYearProgress(null)
  }

  // ── Year range for full-year confirmation label ───────────────────────────
  const fullYearLabel = `Jan–Des ${form.periodYear || currentYear}`

  // ── Tab styling helper ────────────────────────────────────────────────────
  function tabClass(mode: InputMode) {
    const active = form.inputMode === mode
    const base = "px-3 py-1.5 text-xs font-medium transition-colors border-b-2"
    return active
      ? `${base} border-neutral-900 text-neutral-900`
      : `${base} border-transparent text-neutral-500 hover:text-neutral-700`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">

      {/* ── AE / Company selector ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <label className="text-xs font-medium text-neutral-500 shrink-0">View targets for:</label>
        <select
          value={selectedAeId ?? ""}
          onChange={(e) => handleAeChange(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        >
          <option value="">Company (Company-wide)</option>
          {aeOptions.map((ae) => (
            <option key={ae.id} value={ae.id}>
              {ae.name}
            </option>
          ))}
        </select>
        {selectedAeId && (
          <span className="text-xs text-neutral-400">
            Showing targets for {selectedAeName}
          </span>
        )}
      </div>

      {/* ── View mode (Monthly / Quarterly progress view) ──────────────────── */}
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

          {/* Set Target card — admin only */}
          {!isAdmin && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <p className="text-sm text-neutral-400">Hanya admin yang dapat mengatur target.</p>
            </div>
          )}
          {isAdmin && <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">
              {form.editingId ? "Edit Target" : "Set Target"}
              {selectedAeId && (
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  — {selectedAeName}
                </span>
              )}
            </h2>

            {/* 3-tab input mode selector */}
            {!form.editingId && (
              <div className="flex gap-0 border-b border-neutral-100 mb-4">
                <button className={tabClass("per-bulan")} onClick={() => switchInputMode("per-bulan")}>
                  Per Bulan
                </button>
                <button className={tabClass("per-kuartal")} onClick={() => switchInputMode("per-kuartal")}>
                  Per Kuartal
                </button>
                <button className={tabClass("setahun-penuh")} onClick={() => switchInputMode("setahun-penuh")}>
                  Setahun Penuh
                </button>
              </div>
            )}

            {/* Full-year confirmation note */}
            {form.inputMode === "setahun-penuh" && !form.editingId && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-3">
                Masukkan total revenue setahun. Sistem akan bagi 12 dan set{" "}
                {form.revenueTarget && !isNaN(parseFloat(form.revenueTarget))
                  ? `${formatIDR(Math.round(parseFloat(form.revenueTarget) / 12))}/bulan`
                  : "target per bulan"}{" "}
                untuk {fullYearLabel}.
              </p>
            )}

            <div className="space-y-3">
              {/* Period selector row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Per Bulan: month selector */}
                {form.inputMode === "per-bulan" && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Bulan</label>
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
                )}

                {/* Per Kuartal: quarter selector */}
                {form.inputMode === "per-kuartal" && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Kuartal</label>
                    <select
                      value={form.periodMonth}
                      onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
                      disabled={!!form.editingId}
                      className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="1">Q1 (Jan–Mar)</option>
                      <option value="2">Q2 (Apr–Jun)</option>
                      <option value="3">Q3 (Jul–Sep)</option>
                      <option value="4">Q4 (Oct–Des)</option>
                    </select>
                  </div>
                )}

                {/* Setahun Penuh: no month selector, just year */}
                {form.inputMode === "setahun-penuh" && (
                  <div className="flex items-end">
                    <p className="text-xs text-neutral-500 pb-2">Jan – Des (semua bulan)</p>
                  </div>
                )}

                {/* Year selector — all modes */}
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Tahun</label>
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
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Revenue Target (IDR)
                  {form.inputMode === "setahun-penuh" && !form.editingId && (
                    <span className="ml-1 font-normal text-neutral-400">— total setahun (÷12 per bulan)</span>
                  )}
                </label>
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
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  New Client Target
                  {form.inputMode === "setahun-penuh" && !form.editingId && (
                    <span className="ml-1 font-normal text-neutral-400">— total setahun (÷12 per bulan)</span>
                  )}
                </label>
                <input
                  type="number"
                  value={form.newClientTarget}
                  onChange={(e) => setForm((f) => ({ ...f, newClientTarget: e.target.value }))}
                  placeholder="0"
                  min={0}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                />
              </div>

              {/* Full-year save progress */}
              {fullYearProgress && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-3 py-2">
                  {fullYearProgress}
                </p>
              )}

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
                  {saving
                    ? "Saving..."
                    : form.editingId
                    ? "Update Target"
                    : form.inputMode === "setahun-penuh"
                    ? `Set Target Jan–Des ${form.periodYear}`
                    : "Save Target"}
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
          </div>}

          {/* Target History table */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">
              Target History
              {selectedAeId && (
                <span className="ml-2 text-xs font-normal text-neutral-400">— {selectedAeName}</span>
              )}
            </h2>
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
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-normal ${
                                t.type === "quarterly"
                                  ? "bg-purple-50 text-purple-600"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger-600 hover:bg-danger-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Target?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Target ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-danger-600 hover:bg-danger-700 text-white"
                                    onClick={() => void handleDeleteTarget(t.id)}
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
              {selectedAeId && (
                <span className="ml-2 text-xs font-normal text-neutral-400">({selectedAeName})</span>
              )}
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
