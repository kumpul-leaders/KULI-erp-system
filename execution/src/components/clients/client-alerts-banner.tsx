"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, HeartPulse, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type AlertType = "health_drop" | "stale_deal"

interface ClientAlert {
  id: string
  type: AlertType
  triggeredAt: string
}

interface ClientAlertsBannerProps {
  alerts: ClientAlert[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const ALERT_BANNER_CONFIG: Record<
  AlertType,
  { icon: React.ReactNode; label: string; bg: string; border: string; text: string }
> = {
  health_drop: {
    icon: <HeartPulse className="h-4 w-4 flex-shrink-0" />,
    label: "Health score turun — perlu perhatian",
    bg: "bg-danger-50 dark:bg-[#1f0a0a]",
    border: "border-danger-200 dark:border-danger-700/50",
    text: "text-danger-700 dark:text-danger-500",
  },
  stale_deal: {
    icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
    label: "Deal tidak aktif dalam waktu lama",
    bg: "bg-neutral-50 dark:bg-card",
    border: "border-neutral-200 dark:border-neutral-100",
    text: "text-neutral-600 dark:text-neutral-400",
  },
}

// ── Banner item ───────────────────────────────────────────────────────────────

interface BannerItemProps {
  alert: ClientAlert
  onDismiss: (id: string) => void
}

function BannerItem({ alert, onDismiss }: BannerItemProps) {
  const [actioning, setActioning] = useState(false)
  const config = ALERT_BANNER_CONFIG[alert.type]

  async function handleAcknowledge() {
    setActioning(true)
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to acknowledge alert")
      }
      toast.success("Alert acknowledged")
      onDismiss(alert.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setActioning(false)
    }
  }

  async function handleResolve() {
    setActioning(true)
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to resolve alert")
      }
      toast.success("Alert resolved")
      onDismiss(alert.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setActioning(false)
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        config.bg,
        config.border,
        config.text
      )}
    >
      {config.icon}
      <p className="flex-1 text-sm font-medium">{config.label}</p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className={cn("h-7 px-2 text-xs", config.text)}
          disabled={actioning}
          onClick={() => void handleAcknowledge()}
        >
          Ack
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn("h-7 px-2 text-xs", config.text)}
          disabled={actioning}
          onClick={() => void handleResolve()}
        >
          Resolve
        </Button>
        <button
          className={cn("ml-1 rounded p-0.5 hover:opacity-70 transition-opacity", config.text)}
          disabled={actioning}
          onClick={() => void handleAcknowledge()}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── ClientAlertsBanner ────────────────────────────────────────────────────────

export function ClientAlertsBanner({ alerts: initialAlerts }: ClientAlertsBannerProps) {
  const [alerts, setAlerts] = useState<ClientAlert[]>(initialAlerts)

  if (alerts.length === 0) return null

  function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert) => (
        <BannerItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </div>
  )
}
