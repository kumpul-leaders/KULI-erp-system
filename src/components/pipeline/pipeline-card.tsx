"use client"

import { useRouter } from "next/navigation"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle, User, Pencil } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatIDR, cn } from "@/lib/utils"
import { ActivityDot } from "@/components/activities/activity-dot"
import type { PipelineStage, ProductLine, LostReason } from "@/types"

// ── Serialized lead shape passed from server ────────────────────────────────

export interface SerializedLead {
  id: string
  clientId: string
  productLine: ProductLine
  description: string | null
  projectType: string
  stage: PipelineStage
  salesId: string | null
  projectedRevenue: number | null
  billingPlan: string | null
  quarter: string | null
  actualRevenue: number | null
  probability: number | null
  probabilityIsManual: boolean
  lostReason: LostReason | null
  lossDealReason: string | null
  invoiceRequestedAt: string | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  updatedAt: string
  /** ISO datetime of the earliest open activity, or null if none */
  nextActivityAt: string | null
  /** ISO datetime string of expected close date, or null */
  expectedCloseDate: string | null
  client: { id: string; name: string; customerCode: string | null }
  sales: { id: string; name: string } | null
  documents: Array<{
    id: string
    type: string
    fileUrl: string
    fileName: string | null
    uploadedAt: string
    createdAt: string
  }>
}

// ── KanbanField type — exported for use in loader and kanban ────────────────

export type KanbanField = "code" | "productLine" | "revenue" | "ae" | "gateWarning" | "billingPlan"

interface PipelineCardProps {
  lead: SerializedLead
  isDragging?: boolean
  visibleFields?: Set<KanbanField>
}

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  brand_placement: "Brand Placement",
  speakership: "Speakership",
  community_event: "Community Event",
  commissioned_event: "Commissioned Event",
  others: "Others",
}

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  budget: "Budget",
  competitor: "Kompetitor",
  timing: "Timing",
  no_decision: "Tidak Ada Keputusan",
  requirements_mismatch: "Requirement Tidak Cocok",
  other: "Lainnya",
}

// Default fields shown when no visibleFields prop is passed (legacy / DragOverlay use)
const DEFAULT_VISIBLE = new Set<KanbanField>([
  "productLine",
  "revenue",
  "ae",
  "gateWarning",
])

// Gate warning: check if lead is missing a required doc for the next stage advance.
function getMissingGateDoc(lead: SerializedLead): string | null {
  const docTypes = lead.documents.map((d) => d.type)

  if (lead.stage === "leads" && !docTypes.includes("quotation")) {
    return "Missing Quotation to advance"
  }
  if (lead.stage === "negotiation" && !docTypes.includes("quotation_signed")) {
    return "Missing Signed Quotation to advance"
  }
  return null
}

// Stale flag: no activity scheduled AND lead not updated in 7+ days AND open stage
const STALE_OPEN_STAGES: PipelineStage[] = ["leads", "pipeline", "negotiation", "contract_renewal"]
const STALE_DAYS = 7

function isStaleWithoutActivity(lead: SerializedLead): boolean {
  if (lead.nextActivityAt !== null) return false
  if (!STALE_OPEN_STAGES.includes(lead.stage)) return false
  const updatedAt = new Date(lead.updatedAt)
  const now = new Date()
  const diffDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays > STALE_DAYS
}

export function PipelineCard({
  lead,
  isDragging,
  visibleFields = DEFAULT_VISIBLE,
}: PipelineCardProps) {
  const router = useRouter()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  }

  const missingDoc = getMissingGateDoc(lead)
  const stale = isStaleWithoutActivity(lead)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isSortableDragging) router.push(`/pipeline/${lead.id}`)
      }}
      className={cn(
        "rounded-lg border border-neutral-200 bg-card p-4 shadow-kanban",
        "cursor-pointer active:cursor-grabbing select-none",
        "transition-shadow duration-150",
        isDragging && "shadow-kanban-drag"
      )}
    >
      {/* Client name */}
      <div className="mb-2">
        <p className="text-sm font-semibold text-neutral-800 leading-tight truncate">
          {lead.client.name}
        </p>

        {/* Customer code — conditional */}
        {visibleFields.has("code") && lead.client.customerCode && (
          <code className="text-xs text-neutral-400 font-mono mt-0.5 block">
            {lead.client.customerCode}
          </code>
        )}
      </div>

      {/* Product line badge — conditional */}
      {visibleFields.has("productLine") && (
        <div className="mb-3">
          <span className="inline-flex items-center rounded-sm bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
            {PRODUCT_LINE_LABELS[lead.productLine]}
          </span>
        </div>
      )}

      {/* Revenue + Probability + Billing Plan + Quarter — conditional */}
      {visibleFields.has("revenue") && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-neutral-800 tabular-nums">
              {lead.projectedRevenue ? formatIDR(lead.projectedRevenue) : "—"}
            </span>
            {/* Probability badge */}
            {lead.probability !== null && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
                        lead.probabilityIsManual
                          ? "bg-warning-100 text-warning-700"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {lead.probabilityIsManual && (
                        <Pencil className="h-2.5 w-2.5 flex-shrink-0" />
                      )}
                      {Math.round(lead.probability)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {lead.probabilityIsManual
                      ? "Probabilitas manual (dikunci)"
                      : "Probabilitas otomatis berdasarkan stage"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {lead.billingPlan && (
              <span className="text-xs text-neutral-500 truncate max-w-[80px]">
                {lead.billingPlan}
              </span>
            )}
            {lead.quarter && (
              <span className="text-xs text-neutral-400 font-mono">
                {lead.quarter}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Billing Plan — conditional */}
      {visibleFields.has("billingPlan") && lead.billingPlan && (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-neutral-500 font-mono">{lead.billingPlan}</span>
        </div>
      )}

      {/* Sales person — conditional */}
      {visibleFields.has("ae") && lead.sales && (
        <div className="flex items-center gap-1.5 mb-2">
          <User className="h-3 w-3 text-neutral-400 flex-shrink-0" />
          <span className="text-xs text-neutral-500 truncate">
            {lead.sales.name}
          </span>
        </div>
      )}

      {/* Gate warning — conditional */}
      {visibleFields.has("gateWarning") && missingDoc && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100">
          <AlertTriangle className="h-3.5 w-3.5 text-warning-500 flex-shrink-0" />
          <span className="text-xs text-warning-700">{missingDoc}</span>
        </div>
      )}

      {/* Lost reason badge — shown on lost_deal cards */}
      {lead.stage === "lost_deal" && lead.lostReason && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-danger-50 text-danger-700 border border-danger-200">
            {LOST_REASON_LABELS[lead.lostReason]}
          </span>
        </div>
      )}

      {/* Activity dot footer */}
      <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center">
        <ActivityDot
          nextActivityAt={lead.nextActivityAt}
          stale={stale}
        />
      </div>
    </div>
  )
}
