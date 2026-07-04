import { cn } from "@/lib/utils"
import type { PipelineStage } from "@/types"

interface StageHistoryEntry {
  id: string
  fromStage: PipelineStage
  toStage: PipelineStage
  changedAt: string
  changer?: { id: string; name: string }
}

interface StageHistoryTimelineProps {
  history: StageHistoryEntry[]
  className?: string
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  leads: "Leads",
  pipeline: "Pipeline",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  lost_deal: "Lost Deal",
  invoiced: "Invoiced",
  contract_renewal: "Contract Renewal",
  no_response: "No Response",
}

function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString))
}

export function StageHistoryTimeline({
  history,
  className,
}: StageHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-neutral-400 py-2">No stage changes recorded yet.</p>
    )
  }

  return (
    <ol className={cn("relative space-y-4 pl-4", className)}>
      {history.map((entry, index) => (
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
            <p className="text-sm text-neutral-800">
              <span className="font-medium text-neutral-500">
                {STAGE_LABELS[entry.fromStage]}
              </span>
              {" "}
              <span className="text-neutral-400">→</span>
              {" "}
              <span className="font-semibold text-neutral-800">
                {STAGE_LABELS[entry.toStage]}
              </span>
            </p>
            {entry.changer && (
              <p className="text-xs text-neutral-400 mt-0.5">
                by {entry.changer.name}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
