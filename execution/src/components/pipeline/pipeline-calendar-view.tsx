"use client"

/**
 * PipelineCalendarView — Month grid for pipeline leads.
 *
 * Each cell shows leads whose expectedCloseDate falls on that day.
 * Chip: client name + formatted revenue, colored per stage.
 * Click chip → navigate to /pipeline/[id].
 * Leads with no expectedCloseDate appear in "Tanpa tanggal" collapsible row.
 *
 * Data is already filtered by the parent loader (filteredLeads).
 */

import { useRouter } from "next/navigation"
import { MonthCalendar, type CalendarItem } from "@/components/shared/month-calendar"
import { formatIDR, cn } from "@/lib/utils"
import type { SerializedLead } from "./pipeline-card"
import type { PipelineStage } from "@/types"

// ── Stage chip color map ───────────────────────────────────────────────────────

const STAGE_CHIP_CLASSES: Record<PipelineStage, string> = {
  leads:            "bg-neutral-100 text-neutral-700 border-neutral-200",
  pipeline:         "bg-info-50 text-info-700 border-info-200",
  negotiation:      "bg-warning-50 text-warning-700 border-warning-200",
  closed_won:       "bg-success-50 text-success-700 border-success-200",
  lost_deal:        "bg-danger-50 text-danger-700 border-danger-200",
  invoiced:         "bg-accent-100 text-accent-700 border-accent-200",
  contract_renewal: "bg-warning-50 text-warning-700 border-warning-200",
  no_response:      "bg-neutral-100 text-neutral-400 border-neutral-200",
}

// ── Lead chip ─────────────────────────────────────────────────────────────────

interface LeadChipProps {
  lead: SerializedLead
}

function LeadChip({ lead }: LeadChipProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        router.push(`/pipeline/${lead.id}`)
      }}
      className={cn(
        "w-full text-left rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
        STAGE_CHIP_CLASSES[lead.stage]
      )}
      title={`${lead.client.name}${lead.projectedRevenue ? ` — ${formatIDR(lead.projectedRevenue)}` : ""}`}
    >
      <span className="block truncate">{lead.client.name}</span>
      {lead.projectedRevenue !== null && (
        <span className="block tabular-nums opacity-70">
          {formatIDR(lead.projectedRevenue)}
        </span>
      )}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PipelineCalendarViewProps {
  leads: SerializedLead[]
}

export function PipelineCalendarView({ leads }: PipelineCalendarViewProps) {
  const items: CalendarItem[] = leads.map((lead) => ({
    // expectedCloseDate is ISO datetime string or null
    date: lead.expectedCloseDate ? lead.expectedCloseDate.slice(0, 10) : null,
    render: () => <LeadChip lead={lead} />,
  }))

  return (
    <MonthCalendar
      items={items}
      undatedLabel="Leads tanpa close date"
    />
  )
}
