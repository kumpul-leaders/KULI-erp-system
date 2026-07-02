"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { HealthStatus } from "@/types"

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  score: number
  band: string
  signalActivity: number | null
  signalRenewal: number | null
  signalRevenue: number | null
  signalEngagement: number | null
  computedAt: string // ISO string
}

interface HealthScorePopoverProps {
  status: HealthStatus
  snapshot: HealthSnapshot | null
  className?: string
}

// ── Badge config ──────────────────────────────────────────────────────────────

const healthConfig: Record<HealthStatus, { label: string; badgeClass: string }> = {
  healthy: {
    label: "Healthy",
    badgeClass: "border-transparent bg-success-50 text-success-700 hover:bg-success-50",
  },
  at_risk: {
    label: "At Risk",
    badgeClass: "border-transparent bg-warning-50 text-warning-700 hover:bg-warning-50",
  },
  churned: {
    label: "Churned",
    badgeClass: "border-transparent bg-danger-50 text-danger-700 hover:bg-danger-50",
  },
}

// ── Signal bar ────────────────────────────────────────────────────────────────

interface SignalBarProps {
  label: string
  value: number | null
}

function SignalBar({ label, value }: SignalBarProps) {
  const pct = value !== null ? Math.min(100, Math.max(0, Math.round(value))) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
        <span className="text-xs font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
          {pct !== null ? `${pct}` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-600 overflow-hidden">
        {pct !== null && (
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 75 ? "bg-success-500" : pct >= 50 ? "bg-warning-500" : "bg-danger-500"
            )}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  )
}

// ── HealthScorePopover ────────────────────────────────────────────────────────

export function HealthScorePopover({ status, snapshot, className }: HealthScorePopoverProps) {
  const config = healthConfig[status]
  if (!config) {
    return (
      <Badge className={cn("border-transparent bg-neutral-100 text-neutral-500", className)}>
        —
      </Badge>
    )
  }

  const trigger = (
    <Badge
      className={cn(
        config.badgeClass,
        "cursor-pointer select-none gap-1.5",
        className
      )}
    >
      {config.label}
      {snapshot && (
        <span className="font-bold tabular-nums">
          {Math.round(snapshot.score)}
        </span>
      )}
    </Badge>
  )

  if (!snapshot) {
    // No snapshot: show tooltip-like badge without popover interaction
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-64 p-3 text-xs" align="start">
          <p className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">
            Health Score v1 (proxy)
          </p>
          <p className="text-neutral-400">
            Health score belum dihitung. Cron job akan memprosesnya secara otomatis.
          </p>
        </PopoverContent>
      </Popover>
    )
  }

  const computedDate = new Date(snapshot.computedAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
              Health Score v1 (proxy)
            </p>
            <span className="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-100">
              {Math.round(snapshot.score)}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Dihitung {computedDate}
          </p>
        </div>

        <div className="space-y-2.5">
          <SignalBar label="Aktivitas" value={snapshot.signalActivity} />
          <SignalBar label="Renewal" value={snapshot.signalRenewal} />
          <SignalBar label="Revenue" value={snapshot.signalRevenue} />
          <SignalBar label="Engagement" value={snapshot.signalEngagement} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
