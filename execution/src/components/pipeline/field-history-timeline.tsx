import { cn, formatIDR } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldHistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedAt: string
  changer?: { id: string; name: string }
}

interface FieldHistoryTimelineProps {
  history: FieldHistoryEntry[]
  className?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  projectedRevenue: "Projected Revenue",
  projectType: "Project Type",
  billingPlan: "Billing Plan",
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString))
}

function formatFieldValue(field: string, value: string | null): string {
  if (value === null) return "—"

  if (field === "projectedRevenue") {
    const num = parseFloat(value)
    return isNaN(num) ? "—" : formatIDR(num)
  }

  if (field === "projectType") {
    if (value === "one_time") return "One Time"
    if (value === "retainer") return "Retainer"
    return value
  }

  // billingPlan and any other field: show as-is
  return value
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FieldHistoryTimeline({
  history,
  className,
}: FieldHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-2">No field changes recorded yet.</p>
    )
  }

  return (
    <ol className={cn("relative space-y-4 pl-4", className)}>
      {history.map((entry, index) => {
        const label = FIELD_LABELS[entry.field] ?? entry.field
        const oldFormatted = formatFieldValue(entry.field, entry.oldValue)
        const newFormatted = formatFieldValue(entry.field, entry.newValue)

        return (
          <li key={entry.id} className="relative">
            {/* Connector line */}
            {index < history.length - 1 && (
              <div className="absolute left-[-13px] top-5 h-full w-px bg-neutral-200" />
            )}

            {/* Dot */}
            <div className="absolute left-[-17px] top-1.5 h-2 w-2 rounded-full bg-accent-500 border-2 border-white ring-2 ring-neutral-200" />

            <div>
              <p className="text-xs text-neutral-500 mb-0.5">
                {formatDateTime(entry.changedAt)}
              </p>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">
                {label}
              </p>
              <p className="text-sm text-neutral-800">
                <span className="text-neutral-400 tabular-nums">{oldFormatted}</span>
                {" "}
                <span className="text-neutral-400">→</span>
                {" "}
                <span className="font-semibold text-neutral-800 tabular-nums">{newFormatted}</span>
              </p>
              {entry.changer && (
                <p className="text-xs text-neutral-400 mt-0.5">
                  by {entry.changer.name}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
