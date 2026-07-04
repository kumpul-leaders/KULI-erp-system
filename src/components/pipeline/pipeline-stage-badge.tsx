import { cn } from "@/lib/utils"
import type { PipelineStage } from "@/types"

interface PipelineStageBadgeProps {
  stage: PipelineStage
  className?: string
}

const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; className: string }
> = {
  leads: {
    label: "Leads",
    className: "bg-neutral-100 text-neutral-600 border-neutral-200",
  },
  pipeline: {
    label: "Pipeline",
    className: "bg-info-50 text-info-700 border-info-200",
  },
  negotiation: {
    label: "Negotiation",
    className: "bg-warning-50 text-warning-700 border-warning-200",
  },
  closed_won: {
    label: "Closed Won",
    className: "bg-success-50 text-success-700 border-success-200",
  },
  lost_deal: {
    label: "Lost Deal",
    className: "bg-danger-50 text-danger-700 border-danger-200",
  },
  invoiced: {
    label: "Invoiced",
    className: "bg-accent-100 text-accent-700 border-accent-200",
  },
  contract_renewal: {
    label: "Contract Renewal",
    className: "bg-warning-50 text-warning-700 border-warning-200",
  },
  no_response: {
    label: "No Response",
    className: "bg-neutral-100 text-neutral-400 border-neutral-200",
  },
}

export function PipelineStageBadge({ stage, className }: PipelineStageBadgeProps) {
  const config = STAGE_CONFIG[stage]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export function getStageName(stage: PipelineStage): string {
  return STAGE_CONFIG[stage].label
}
