"use client"

import { useRouter } from "next/navigation"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AlertTriangle, User } from "lucide-react"
import { formatIDR, cn } from "@/lib/utils"
import type { PipelineStage, ProductLine } from "@/types"

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
  lossDealReason: string | null
  invoiceRequestedAt: string | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  updatedAt: string
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

export type KanbanField = "code" | "productLine" | "revenue" | "ae" | "gateWarning"

interface PipelineCardProps {
  lead: SerializedLead
  isDragging?: boolean
  visibleFields?: Set<KanbanField>
}

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  stracomm: "Stracomm",
  smm: "SMM",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Management",
  production: "Production",
  others: "Others",
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
        "rounded-lg border border-neutral-200 bg-white p-4 shadow-kanban",
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

      {/* Revenue + Billing Plan + Quarter — conditional */}
      {visibleFields.has("revenue") && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-neutral-800 tabular-nums">
            {lead.projectedRevenue ? formatIDR(lead.projectedRevenue) : "—"}
          </span>
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
    </div>
  )
}
