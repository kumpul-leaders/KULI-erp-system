"use client"

import { useState, useCallback, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PipelineCard, type SerializedLead, type KanbanField, LOST_REASON_LABELS } from "./pipeline-card"
import { formatIDRCompact } from "@/lib/utils"
import type { PipelineStage, LostReason } from "@/types"

// ── Column config ────────────────────────────────────────────────────────────

interface StageColumn {
  id: PipelineStage
  label: string
  colorClass: string
}

const STAGE_COLUMNS: StageColumn[] = [
  { id: "leads", label: "Leads", colorClass: "bg-neutral-400" },
  { id: "pipeline", label: "Pipeline", colorClass: "bg-info-500" },
  { id: "negotiation", label: "Negotiation", colorClass: "bg-warning-500" },
  { id: "closed_won", label: "Closed Won", colorClass: "bg-success-500" },
  { id: "invoiced", label: "Invoiced", colorClass: "bg-accent-500" },
  { id: "contract_renewal", label: "Contract Renewal", colorClass: "bg-warning-500" },
  { id: "lost_deal", label: "Lost Deal", colorClass: "bg-danger-500" },
  { id: "no_response", label: "No Response", colorClass: "bg-neutral-300" },
]

// ── Kanban sort ──────────────────────────────────────────────────────────────

export type KanbanSortKey =
  | "default"
  | "revenue_desc"
  | "revenue_asc"
  | "name_asc"
  | "quarter"
  | "created_desc"

function sortLeadsForKanban(
  leads: SerializedLead[],
  sortKey: KanbanSortKey
): SerializedLead[] {
  if (sortKey === "default") return leads
  return [...leads].sort((a, b) => {
    switch (sortKey) {
      case "revenue_desc":
        return (b.projectedRevenue ?? 0) - (a.projectedRevenue ?? 0)
      case "revenue_asc":
        return (a.projectedRevenue ?? 0) - (b.projectedRevenue ?? 0)
      case "name_asc":
        return a.client.name.localeCompare(b.client.name)
      case "quarter":
        return (a.quarter ?? "").localeCompare(b.quarter ?? "")
      case "created_desc":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      default:
        return 0
    }
  })
}

// ── Droppable Column ─────────────────────────────────────────────────────────

import { useDroppable } from "@dnd-kit/core"

interface KanbanColumnProps {
  column: StageColumn
  leads: SerializedLead[]
  activeId: string | null
  visibleFields: Set<KanbanField>
}

function KanbanColumn({
  column,
  leads,
  activeId,
  visibleFields,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const leadIds = leads.map((l) => l.id)

  // Column stats — computed client-side from loaded leads
  const totalRevenue = leads.reduce((sum, l) => sum + (l.projectedRevenue ?? 0), 0)
  const weightedRevenue = leads.reduce(
    (sum, l) => sum + (l.projectedRevenue ?? 0) * ((l.probability ?? 0) / 100),
    0
  )

  return (
    <div
      ref={setNodeRef}
      className={`flex w-70 flex-shrink-0 flex-col rounded-lg transition-colors ${
        isOver ? "bg-accent-50" : "bg-neutral-50"
      }`}
    >
      {/* Column header */}
      <div className="flex flex-col gap-1 px-3 py-2.5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${column.colorClass}`} />
            <span className="text-sm font-semibold text-neutral-700">
              {column.label}
            </span>
          </div>
          <span className="text-xs font-medium text-neutral-400 tabular-nums">
            {leads.length}
          </span>
        </div>
        {/* Revenue stats row */}
        {leads.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pl-4">
            <span className="text-xs text-neutral-500 tabular-nums">
              {formatIDRCompact(totalRevenue)}
            </span>
            {weightedRevenue > 0 && (
              <>
                <span className="text-xs text-neutral-300">·</span>
                <span className="text-xs text-neutral-400 tabular-nums" title="Weighted (probability-adjusted)">
                  ~{formatIDRCompact(weightedRevenue)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Closed Won info note */}
      {column.id === "closed_won" && (
        <div className="mx-2 mt-1 mb-0 rounded-md bg-info-50 border border-info-200 px-2.5 py-1.5">
          <p className="text-xs text-info-700">
            Gunakan tombol <span className="font-semibold">&quot;Request Invoice&quot;</span> di detail lead untuk advance ke Invoiced.
          </p>
        </div>
      )}

      {/* Cards */}
      <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 min-h-16">
          {leads.map((lead) => (
            <PipelineCard
              key={lead.id}
              lead={lead}
              isDragging={lead.id === activeId}
              visibleFields={visibleFields}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Lost Deal Reason Dialog ──────────────────────────────────────────────────
// Simple inline dialog — not using shadcn Dialog to avoid nesting DndContext.

const LOST_REASON_OPTIONS: Array<{ value: LostReason; label: string }> = [
  { value: "budget", label: "Budget" },
  { value: "competitor", label: "Kompetitor" },
  { value: "timing", label: "Timing" },
  { value: "no_decision", label: "Tidak Ada Keputusan" },
  { value: "requirements_mismatch", label: "Requirement Tidak Cocok" },
  { value: "other", label: "Lainnya" },
]

interface LostDealDialogProps {
  onConfirm: (lostReason: LostReason, note: string) => void
  onCancel: () => void
}

function LostDealDialog({ onConfirm, onCancel }: LostDealDialogProps) {
  const [lostReason, setLostReason] = useState<LostReason | "">("")
  const [note, setNote] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-modal p-6 w-full max-w-md mx-4">
        <h2 className="text-base font-semibold text-neutral-800 mb-1">
          Mark as Lost Deal
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Pilih alasan utama kehilangan deal ini.
        </p>

        {/* Structured reason — required */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
            Alasan <span className="text-danger-500">*</span>
          </label>
          <Select
            value={lostReason}
            onValueChange={(v) => setLostReason(v as LostReason)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih alasan..." />
            </SelectTrigger>
            <SelectContent>
              {LOST_REASON_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Free-text note — optional */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
            Catatan tambahan <span className="text-neutral-400 font-normal">(opsional)</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-neutral-200 bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
            rows={2}
            placeholder="Detail tambahan..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            disabled={!lostReason}
            className="px-4 py-2 rounded-md bg-danger-500 text-sm font-medium text-white hover:bg-danger-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              if (lostReason) onConfirm(lostReason, note.trim())
            }}
          >
            Confirm Lost
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Kanban board ────────────────────────────────────────────────────────

interface PipelineKanbanProps {
  initialLeads: SerializedLead[]
  visibleFields: Set<KanbanField>
  sortKey: KanbanSortKey
}

export function PipelineKanban({
  initialLeads,
  visibleFields,
  sortKey,
}: PipelineKanbanProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<SerializedLead[]>(() =>
    sortLeadsForKanban(initialLeads, sortKey)
  )
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync leads when initialLeads (filter changes) or sortKey changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeads(sortLeadsForKanban(initialLeads, sortKey))
  }, [initialLeads, sortKey])

  // Lost deal dialog state
  const [lostDealPending, setLostDealPending] = useState<{
    leadId: string
    fromStage: PipelineStage
    toStage: PipelineStage
  } | null>(null)

  // Sensors — require 8px drag distance to distinguish from clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // Group leads by stage
  const leadsByStage = useCallback(
    (stage: PipelineStage) => leads.filter((l) => l.stage === stage),
    [leads]
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  async function performStageChange(
    leadId: string,
    toStage: PipelineStage,
    lostPayload?: { lostReason: LostReason; lossDealReason: string }
  ) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    const fromStage = lead.stage

    // Optimistically update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: toStage } : l))
    )

    try {
      const body: Record<string, unknown> = { toStage }
      if (lostPayload) {
        body.lostReason = lostPayload.lostReason
        body.lossDealReason = lostPayload.lossDealReason || lostPayload.lostReason
      }

      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        // Revert on failure
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, stage: fromStage } : l))
        )
        toast.error(data.error ?? "Failed to move lead")
        return
      }

      const data = (await res.json()) as { lead: SerializedLead }
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? data.lead : l))
      )
      toast.success(`Moved to ${toStage.replace(/_/g, " ")}`)
      router.refresh()
    } catch {
      // Revert on network error
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: fromStage } : l))
      )
      toast.error("Network error — please try again")
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)

    const { active, over } = event
    if (!over) return

    const leadId = String(active.id)
    const overId = String(over.id)

    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // Determine target stage — over.id could be a stage column id or a lead id
    const isStageId = STAGE_COLUMNS.some((col) => col.id === overId)
    const targetStage: PipelineStage = isStageId
      ? (overId as PipelineStage)
      : (leads.find((l) => l.id === overId)?.stage ?? lead.stage)

    if (targetStage === lead.stage) return

    // Blocked: closed_won → invoiced must use Request Invoice button
    if (lead.stage === "closed_won" && targetStage === "invoiced") {
      toast.error("Use the 'Request Invoice' button to move a deal to Invoiced")
      return
    }

    // lost_deal requires reason
    if (targetStage === "lost_deal") {
      setLostDealPending({ leadId, fromStage: lead.stage, toStage: "lost_deal" })
      return
    }

    void performStageChange(leadId, targetStage)
  }

  // Active lead card being dragged
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-6 h-full">
          {STAGE_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              leads={leadsByStage(col.id)}
              activeId={activeId}
              visibleFields={visibleFields}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <div className="rotate-1 shadow-kanban-drag">
              <PipelineCard lead={activeLead} isDragging visibleFields={visibleFields} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Lost deal reason dialog */}
      {lostDealPending && (
        <LostDealDialog
          onConfirm={(lostReason, note) => {
            void performStageChange(lostDealPending.leadId, "lost_deal", {
              lostReason,
              lossDealReason: note || LOST_REASON_LABELS[lostReason],
            })
            setLostDealPending(null)
          }}
          onCancel={() => {
            setLostDealPending(null)
          }}
        />
      )}
    </>
  )
}
