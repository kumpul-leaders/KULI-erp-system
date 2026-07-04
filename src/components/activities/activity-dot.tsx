"use client"

/**
 * ActivityDot — small colored dot with tooltip.
 *
 * Variants:
 *   - activity present: dot colored by status (green/orange/red), tooltip shows subject + date
 *   - no activity (null): grey dot, tooltip "Tidak ada activity terjadwal"
 *   - stale flag: grey dot + warning icon, tooltip "Deal tanpa aktivitas >7 hari"
 *
 * "use client" required for Tooltip interaction (Radix portal).
 */

import { AlertTriangle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getActivityStatus,
  ACTIVITY_STATUS_CLASSES,
  formatActivityDate,
} from "@/components/activities/activity-status"

interface ActivityDotProps {
  /** ISO datetime string (nextActivityAt from lead) or null */
  nextActivityAt: string | null
  /** Subject of the next activity, used in tooltip */
  subject?: string | null
  /** If true, show stale warning icon instead of just grey dot */
  stale?: boolean
}

export function ActivityDot({ nextActivityAt, subject, stale }: ActivityDotProps) {
  if (!nextActivityAt) {
    const tooltipText = stale
      ? "Deal tanpa aktivitas lebih dari 7 hari"
      : "Tidak ada activity terjadwal"

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 cursor-default">
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-300 flex-shrink-0" />
              {stale && (
                <AlertTriangle className="h-3 w-3 text-warning-500 flex-shrink-0" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Extract date portion for status calculation
  const dueDate = nextActivityAt.slice(0, 10)
  const status = getActivityStatus(dueDate)
  const classes = ACTIVITY_STATUS_CLASSES[status]
  const dateLabel = formatActivityDate(dueDate)
  const tooltipText = subject
    ? `Follow-up: ${subject} — ${dateLabel}`
    : `Activity terjadwal: ${dateLabel}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-default">
            <span
              className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${classes.dot}`}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
