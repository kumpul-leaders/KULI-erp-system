"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Bell, AlertTriangle, HeartPulse, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type AlertType = "renewal_t60" | "renewal_t30" | "health_drop" | "stale_deal"
type AlertStatus = "open" | "acknowledged" | "resolved"

interface Alert {
  id: string
  type: AlertType
  status: AlertStatus
  triggeredAt: string
  client: { id: string; name: string } | null
  lead: { id: string; description: string | null } | null
  assignee: { id: string; name: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeAge(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}j ago`
  const days = Math.floor(hrs / 24)
  return `${days}h ago`
}

const ALERT_CONFIG: Record<AlertType, { icon: React.ReactNode; label: string; color: string }> = {
  renewal_t60: {
    icon: <Clock className="h-4 w-4" />,
    label: "Renewal T-60",
    color: "text-warning-600",
  },
  renewal_t30: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Renewal T-30",
    color: "text-danger-600",
  },
  health_drop: {
    icon: <HeartPulse className="h-4 w-4" />,
    label: "Health Drop",
    color: "text-danger-600",
  },
  stale_deal: {
    icon: <Bell className="h-4 w-4" />,
    label: "Stale Deal",
    color: "text-neutral-500",
  },
}

// ── AlertsPanel ───────────────────────────────────────────────────────────────

interface AlertsPanelProps {
  /** Passed from server: contracts expiring in 90d — shown as fallback when 0 open alerts */
  expiringContracts: { id: string; name: string; contractEnd: string | null }[]
}

export function AlertsPanel({ expiringContracts }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts?status=open")
      if (!res.ok) throw new Error("Failed to fetch alerts")
      const data = (await res.json()) as { alerts: Alert[] }
      setAlerts((data.alerts ?? []).slice(0, 8))
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])

  async function handleAction(alertId: string, action: "acknowledge" | "resolve") {
    setActioning(alertId)
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update alert")
      }
      toast.success(action === "acknowledge" ? "Alert acknowledged" : "Alert resolved")
      // Remove from list optimistically
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-700">
          Alerts
        </h2>
        <button
          onClick={() => { setLoading(true); void fetchAlerts() }}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          aria-label="Refresh alerts"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-md shimmer" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        // Empty state — fall back to expiring contracts if any, else clean empty
        expiringContracts.length > 0 ? (
          <div>
            <p className="text-xs text-neutral-400 mb-3">Tidak ada alert aktif. Kontrak mendekati expiry:</p>
            {expiringContracts.slice(0, 5).map((c) => {
              if (!c.contractEnd) return null
              const days = Math.ceil(
                (new Date(c.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="flex items-center justify-between mb-2 last:mb-0 rounded-md bg-neutral-50 dark:bg-neutral-50/50 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-100 transition-colors"
                >
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-700 truncate">
                    {c.name}
                  </span>
                  <span className={cn(
                    "text-xs font-medium flex-shrink-0 ml-2 px-1.5 py-0.5 rounded-sm",
                    days <= 30
                      ? "bg-danger-50 text-danger-700"
                      : days <= 60
                        ? "bg-warning-50 text-warning-700"
                        : "bg-info-50 text-info-700"
                  )}>
                    {days}d
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 py-2">
            Tidak ada alert aktif dan tidak ada kontrak yang akan berakhir dalam 90 hari.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const config = ALERT_CONFIG[alert.type]
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-md border border-neutral-100 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-50/40 px-3 py-2.5"
              >
                {/* Icon */}
                <span className={cn("mt-0.5 flex-shrink-0", config.color)}>
                  {config.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                      {config.label}
                    </span>
                    {alert.client && (
                      <Link
                        href={`/clients/${alert.client.id}`}
                        className="text-sm font-semibold text-neutral-800 dark:text-neutral-700 hover:text-accent-600 hover:underline truncate"
                      >
                        {alert.client.name}
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {relativeAge(alert.triggeredAt)}
                    {alert.assignee && ` · ${alert.assignee.name}`}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                    disabled={actioning === alert.id}
                    onClick={() => void handleAction(alert.id, "acknowledge")}
                  >
                    Ack
                  </Button>
                  {alert.type.startsWith("renewal") && alert.client && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-accent-600 hover:text-accent-700"
                      disabled={actioning === alert.id}
                      asChild
                    >
                      <Link href={`/clients/${alert.client.id}`}>
                        View
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
