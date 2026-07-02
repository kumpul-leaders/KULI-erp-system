"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  PipelineStageConfigSchema,
  DEFAULT_STAGE_CONFIG,
  type PipelineStageConfig,
  type StageConfigEntry,
} from "@/lib/stage-config"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsPipelineTabProps {
  isAdmin: boolean
  initialStageConfig: PipelineStageConfig
}

// All 8 pipeline stages in display order
const STAGE_ORDER: Array<keyof PipelineStageConfig> = [
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "invoiced",
  "contract_renewal",
  "lost_deal",
  "no_response",
]

const STAGE_LABELS: Record<keyof PipelineStageConfig, string> = {
  leads: "Leads",
  pipeline: "Pipeline",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  invoiced: "Invoiced",
  contract_renewal: "Contract Renewal",
  lost_deal: "Lost Deal",
  no_response: "No Response",
}

// ── Local row state ───────────────────────────────────────────────────────────

type RowState = {
  probability: string   // string for input binding; parsed on save
  countsAsForecast: boolean
}

function configToRowState(config: PipelineStageConfig): Record<keyof PipelineStageConfig, RowState> {
  return Object.fromEntries(
    STAGE_ORDER.map((stage) => [
      stage,
      {
        probability: String(config[stage].probability),
        countsAsForecast: config[stage].countsAsForecast,
      },
    ])
  ) as Record<keyof PipelineStageConfig, RowState>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SettingsPipelineTab({ isAdmin, initialStageConfig }: SettingsPipelineTabProps) {
  const [rows, setRows] = useState<Record<keyof PipelineStageConfig, RowState>>(() =>
    configToRowState(initialStageConfig)
  )
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof PipelineStageConfig, string>>>({})

  function updateProbability(stage: keyof PipelineStageConfig, value: string) {
    setRows((prev) => ({ ...prev, [stage]: { ...prev[stage], probability: value } }))
    // Clear error when user is typing
    if (validationErrors[stage]) {
      setValidationErrors((prev) => {
        const next = { ...prev }
        delete next[stage]
        return next
      })
    }
  }

  function updateCountsAsForecast(stage: keyof PipelineStageConfig, value: boolean) {
    setRows((prev) => ({ ...prev, [stage]: { ...prev[stage], countsAsForecast: value } }))
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof PipelineStageConfig, string>> = {}
    for (const stage of STAGE_ORDER) {
      const raw = rows[stage].probability
      const parsed = Number(raw)
      if (raw.trim() === "" || isNaN(parsed) || parsed < 0 || parsed > 100 || !Number.isInteger(parsed)) {
        errors[stage] = "Harus angka 0–100"
      }
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!validate()) return

    // Build the full config object, preserving existing order/color from initial
    const newConfig: PipelineStageConfig = Object.fromEntries(
      STAGE_ORDER.map((stage) => {
        const existing: StageConfigEntry = initialStageConfig[stage]
        return [
          stage,
          {
            probability: Number(rows[stage].probability),
            order: existing.order,
            color: existing.color,
            countsAsForecast: rows[stage].countsAsForecast,
          } satisfies StageConfigEntry,
        ]
      })
    ) as PipelineStageConfig

    // Client-side Zod validation before sending
    const parsed = PipelineStageConfigSchema.safeParse(newConfig)
    if (!parsed.success) {
      toast.error("Validasi gagal. Periksa nilai probability.")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/system-config/pipeline_stage_config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: parsed.data }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? "Gagal menyimpan konfigurasi.")
        return
      }
      toast.success("Konfigurasi pipeline disimpan.")
    } catch {
      toast.error("Network error. Coba lagi.")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setRows(configToRowState(DEFAULT_STAGE_CONFIG))
    setValidationErrors({})
    toast.info("Reset ke default. Klik Save untuk menyimpan.")
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-neutral-800">Pipeline Stage Config</h3>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleReset}
              disabled={saving}
            >
              Reset Default
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-4">
        Mengubah probability tidak mengubah lead yang probabilitynya sudah di-set manual.
      </p>

      <div className="rounded-md border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/3">Stage</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/4">
                Probability (0–100)
              </th>
              <th className="text-left px-4 py-3 font-medium text-neutral-500">
                Counts as Forecast
              </th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ORDER.map((stage) => {
              const row = rows[stage]
              const error = validationErrors[stage]
              return (
                <tr key={stage} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-700">
                    {STAGE_LABELS[stage]}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={row.probability}
                            onChange={(e) => updateProbability(stage, e.target.value)}
                            className="w-20 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-neutral-50"
                          />
                          <span className="text-xs text-neutral-400">%</span>
                        </div>
                        {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
                      </div>
                    ) : (
                      <span className="text-neutral-700 tabular-nums">{row.probability}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <Switch
                        checked={row.countsAsForecast}
                        onCheckedChange={(v) => updateCountsAsForecast(stage, v)}
                        aria-label={`${STAGE_LABELS[stage]} counts as forecast`}
                      />
                    ) : (
                      <span className={`text-xs font-medium ${row.countsAsForecast ? "text-emerald-600" : "text-neutral-400"}`}>
                        {row.countsAsForecast ? "Ya" : "Tidak"}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
