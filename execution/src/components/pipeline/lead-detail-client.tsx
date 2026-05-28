"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Check, X, ChevronDown, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StageHistoryTimeline } from "@/components/pipeline/stage-history-timeline"
import { FieldHistoryTimeline } from "@/components/pipeline/field-history-timeline"
import { DocumentUploadZone } from "@/components/pipeline/document-upload-zone"
import { PipelineStageBadge } from "@/components/pipeline/pipeline-stage-badge"
import { formatIDR, getInitials } from "@/lib/utils"
import type { PipelineStage, ProductLine, ProjectType, DocumentType } from "@/types"

// ── Serialized types (Dates as ISO strings, Decimals as numbers) ──────────────

interface SerializedDocument {
  id: string
  leadId: string
  type: DocumentType
  fileUrl: string
  fileName: string | null
  uploadedAt: string
  uploadedBy: string
  createdAt: string
  uploader?: { id: string; name: string }
}

interface SerializedStageHistory {
  id: string
  leadId: string
  fromStage: PipelineStage
  toStage: PipelineStage
  changedBy: string
  changedAt: string
  changer?: { id: string; name: string }
}

interface SerializedFieldHistory {
  id: string
  leadId: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
  changer?: { id: string; name: string }
}

interface SerializedLead {
  id: string
  clientId: string
  productLine: ProductLine
  description: string | null
  projectType: ProjectType
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
  expectedCloseDate: string | null
  updatedAt: string
  client: { id: string; name: string; customerCode: string | null }
  sales: { id: string; name: string } | null
  documents: SerializedDocument[]
  stageHistory: SerializedStageHistory[]
  fieldHistory: SerializedFieldHistory[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  stracomm: "Stracomm",
  smm: "Social Media",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Management",
  production: "Production",
  others: "Others",
}

// Stage sequence for forward-only advance
const STAGE_SEQUENCE: PipelineStage[] = [
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "invoiced",
]

const TERMINAL_STAGES: PipelineStage[] = [
  "lost_deal",
  "invoiced",
  "no_response",
  "contract_renewal",
]

const STAGE_NEXT_LABELS: Partial<Record<PipelineStage, string>> = {
  leads: "Move to Pipeline",
  pipeline: "Move to Negotiation",
  negotiation: "Move to Closed Won",
  closed_won: "Request Invoice",
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StageActionsProps {
  leadId: string
  stage: PipelineStage
}

function StageActions({ leadId, stage }: StageActionsProps) {
  const router = useRouter()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [lostDealOpen, setLostDealOpen] = useState(false)
  const [lostDealReason, setLostDealReason] = useState("")
  const [advancing, setAdvancing] = useState(false)
  const [invoicing, setInvoicing] = useState(false)

  const isTerminal = TERMINAL_STAGES.includes(stage)
  const isClosedWon = stage === "closed_won"
  const isLostDeal = stage === "lost_deal"

  // Determine next forward stage
  const currentIdx = STAGE_SEQUENCE.indexOf(stage)
  const nextStage =
    currentIdx >= 0 && currentIdx < STAGE_SEQUENCE.length - 1
      ? STAGE_SEQUENCE[currentIdx + 1]
      : null

  async function handleAdvanceStage(toStage: PipelineStage) {
    setAdvancing(true)
    setPopoverOpen(false)
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to advance stage")
      }
      toast.success("Stage updated")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setAdvancing(false)
    }
  }

  async function handleRequestInvoice() {
    setInvoicing(true)
    setPopoverOpen(false)
    try {
      const res = await fetch(`/api/leads/${leadId}/invoice`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to request invoice")
      }
      toast.success("Invoice requested")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setInvoicing(false)
    }
  }

  async function handleLostDealConfirm() {
    if (!lostDealReason.trim()) {
      toast.error("Loss reason is required")
      return
    }
    setAdvancing(true)
    setLostDealOpen(false)
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: "lost_deal", lossDealReason: lostDealReason.trim() }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to mark as lost deal")
      }
      toast.success("Lead marked as Lost Deal")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setAdvancing(false)
      setLostDealReason("")
    }
  }

  if (isTerminal && !isClosedWon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled aria-disabled className="opacity-50">
                Advance Stage
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>This lead is closed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (isClosedWon) {
    return (
      <Button
        size="sm"
        onClick={handleRequestInvoice}
        disabled={invoicing}
      >
        {invoicing ? "Requesting..." : "Request Invoice"}
      </Button>
    )
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" disabled={advancing} className="gap-1.5">
            {advancing ? "Updating..." : "Advance Stage"}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {nextStage && STAGE_NEXT_LABELS[stage] && (
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 transition-colors text-left"
                onClick={() => void handleAdvanceStage(nextStage)}
              >
                {STAGE_NEXT_LABELS[stage]}
              </button>
            )}
            {nextStage && <div className="h-px bg-neutral-200 my-1" />}
            {stage !== "no_response" && (
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 transition-colors text-left"
                onClick={() => void handleAdvanceStage("no_response")}
              >
                Move to No Response
              </button>
            )}
            {!isLostDeal && (
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors text-left"
                onClick={() => {
                  setPopoverOpen(false)
                  setLostDealOpen(true)
                }}
              >
                Move to Lost Deal
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Lost Deal Dialog */}
      <AlertDialog open={lostDealOpen} onOpenChange={setLostDealOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Lost Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for losing this deal. This cannot be undone without admin access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="e.g. Budget constraints, competitor selected, no response..."
              value={lostDealReason}
              onChange={(e) => setLostDealReason(e.target.value)}
              rows={3}
              className="resize-none"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLostDealReason("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-500 hover:bg-danger-700 text-white"
              onClick={() => void handleLostDealConfirm()}
              disabled={!lostDealReason.trim()}
            >
              Confirm Lost Deal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Notes inline edit ─────────────────────────────────────────────────────────

interface NotesInlineProps {
  leadId: string
  initialNotes: string | null
}

function NotesInline({ leadId, initialNotes }: NotesInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNotes ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to save notes")
      }
      toast.success("Notes saved")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialNotes ?? "")
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-neutral-800">Notes</h2>
        {!editing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
            aria-label="Edit notes"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder="Add internal notes about this lead..."
            autoFocus
            className="resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="gap-1.5 h-8"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-1.5 h-8"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="text-sm text-neutral-600 whitespace-pre-wrap min-h-[60px] cursor-pointer rounded-md p-2 -m-2 hover:bg-neutral-50 transition-colors"
          onClick={() => setEditing(true)}
        >
          {initialNotes ? (
            initialNotes
          ) : (
            <span className="text-neutral-400 italic">No notes yet. Click to add...</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline field edit — reusable pattern ─────────────────────────────────────

interface InlineFieldProps {
  label: string
  display: React.ReactNode
  editing: boolean
  saving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  children: React.ReactNode
}

function InlineField({
  label,
  display,
  editing,
  saving,
  onEdit,
  onSave,
  onCancel,
  children,
}: InlineFieldProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
        {label}
      </p>
      {editing ? (
        <div className="space-y-2">
          {children}
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-neutral-800">{display}</span>
          <button
            onClick={onEdit}
            className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Inline: Projected Revenue ─────────────────────────────────────────────────

interface ProjectedRevenueInlineProps {
  leadId: string
  initialValue: number | null
}

function ProjectedRevenueInline({ leadId, initialValue }: ProjectedRevenueInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(initialValue !== null ? String(initialValue) : "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const numeric = value === "" ? null : Number(value)
      if (value !== "" && isNaN(Number(value))) {
        toast.error("Invalid number")
        return
      }
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectedRevenue: numeric }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Projected Revenue updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialValue !== null ? String(initialValue) : "")
    setEditing(false)
  }

  return (
    <InlineField
      label="Projected Revenue"
      display={<span className="tabular-nums">{formatIDR(initialValue)}</span>}
      editing={editing}
      saving={saving}
      onEdit={() => setEditing(true)}
      onSave={() => void handleSave()}
      onCancel={handleCancel}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 15000000"
        autoFocus
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder:text-neutral-400"
      />
    </InlineField>
  )
}

// ── Inline: Actual Revenue ────────────────────────────────────────────────────

interface ActualRevenueInlineProps {
  leadId: string
  initialValue: number | null
}

function ActualRevenueInline({ leadId, initialValue }: ActualRevenueInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(initialValue !== null ? String(initialValue) : "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const numeric = value === "" ? null : Number(value)
      if (value !== "" && isNaN(Number(value))) {
        toast.error("Invalid number")
        return
      }
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualRevenue: numeric }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Actual Revenue updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialValue !== null ? String(initialValue) : "")
    setEditing(false)
  }

  return (
    <InlineField
      label="Actual Revenue"
      display={<span className="tabular-nums">{formatIDR(initialValue)}</span>}
      editing={editing}
      saving={saving}
      onEdit={() => setEditing(true)}
      onSave={() => void handleSave()}
      onCancel={handleCancel}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 15000000"
        autoFocus
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder:text-neutral-400"
      />
    </InlineField>
  )
}

// ── Inline: Description ──────────────────────────────────────────────────────

interface DescriptionInlineProps {
  leadId: string
  initialValue: string | null
}

function DescriptionInline({ leadId, initialValue }: DescriptionInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value.trim() || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Description updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialValue ?? "")
    setEditing(false)
  }

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
          Description
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Edit description"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            placeholder="Add a project description..."
            autoFocus
            className="resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm text-neutral-600 whitespace-pre-wrap cursor-pointer rounded-md p-2 -m-2 hover:bg-neutral-50 transition-colors min-h-[32px]"
          onClick={() => setEditing(true)}
        >
          {initialValue ?? (
            <span className="text-neutral-400 italic">No description yet. Click to add...</span>
          )}
        </p>
      )}
    </div>
  )
}

// ── Inline: Project Type ──────────────────────────────────────────────────────

interface ProjectTypeInlineProps {
  leadId: string
  initialValue: ProjectType
}

function ProjectTypeInline({ leadId, initialValue }: ProjectTypeInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<ProjectType>(initialValue)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectType: value }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Project Type updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialValue)
    setEditing(false)
  }

  return (
    <InlineField
      label="Project Type"
      display={initialValue === "one_time" ? "One Time" : "Retainer"}
      editing={editing}
      saving={saving}
      onEdit={() => setEditing(true)}
      onSave={() => void handleSave()}
      onCancel={handleCancel}
    >
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as ProjectType)}
        autoFocus
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
      >
        <option value="one_time">One Time</option>
        <option value="retainer">Retainer</option>
      </select>
    </InlineField>
  )
}

// ── Inline: Billing Plan ──────────────────────────────────────────────────────

interface BillingPlanInlineProps {
  leadId: string
  initialValue: string | null
}

function BillingPlanInline({ leadId, initialValue }: BillingPlanInlineProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = value.trim()
    if (trimmed !== "" && !/^\d{2}-\d{2}$/.test(trimmed)) {
      toast.error("Billing Plan must be in YY-MM format (e.g. 26-08)")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPlan: trimmed || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Billing Plan updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialValue ?? "")
    setEditing(false)
  }

  return (
    <InlineField
      label="Billing Plan"
      display={initialValue ?? "—"}
      editing={editing}
      saving={saving}
      onEdit={() => setEditing(true)}
      onSave={() => void handleSave()}
      onCancel={handleCancel}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="YY-MM (e.g. 26-08)"
        pattern="\d{2}-\d{2}"
        autoFocus
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder:text-neutral-400"
      />
    </InlineField>
  )
}

// ── Documents card ────────────────────────────────────────────────────────────

type UploadedDoc = {
  id: string
  type: string
  fileUrl: string
  fileName: string | null
  uploadedAt: string
}

interface DocumentsCardProps {
  leadId: string
  initialDocuments: SerializedDocument[]
}

function DocumentsCard({ leadId, initialDocuments }: DocumentsCardProps) {
  const [documents, setDocuments] = useState<SerializedDocument[]>(initialDocuments)

  const handleUploadSuccess = useCallback((doc: UploadedDoc) => {
    setDocuments((prev) => [
      {
        id: doc.id,
        leadId,
        type: doc.type as DocumentType,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        uploadedAt: doc.uploadedAt,
        uploadedBy: "",
        createdAt: doc.uploadedAt,
      },
      ...prev.filter((d) => d.type !== doc.type),
    ])
  }, [leadId])

  const quotationDocs = documents
    .filter((d) => d.type === "quotation")
    .map((d) => ({ id: d.id, type: d.type, fileUrl: d.fileUrl, fileName: d.fileName, uploadedAt: d.uploadedAt }))

  const signedDocs = documents
    .filter((d) => d.type === "quotation_signed")
    .map((d) => ({ id: d.id, type: d.type, fileUrl: d.fileUrl, fileName: d.fileName, uploadedAt: d.uploadedAt }))

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <h2 className="font-semibold text-neutral-800 mb-4">Documents</h2>
      <div className="space-y-5">
        <DocumentUploadZone
          leadId={leadId}
          type="quotation"
          label="Quotation"
          existingDocs={quotationDocs}
          onUploadSuccess={handleUploadSuccess}
        />
        <div className="h-px bg-neutral-100" />
        <DocumentUploadZone
          leadId={leadId}
          type="quotation_signed"
          label="Signed Quotation"
          existingDocs={signedDocs}
          onUploadSuccess={handleUploadSuccess}
        />
      </div>
    </div>
  )
}

// ── AE card ───────────────────────────────────────────────────────────────────

interface AeCardProps {
  leadId: string
  sales: { id: string; name: string } | null
  salesOptions: Array<{ id: string; name: string }>
}

function AeCard({ leadId, sales, salesOptions }: AeCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(sales?.id ?? "")
  const [saving, setSaving] = useState(false)
  const initials = sales ? getInitials(sales.name) : "?"

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesId: selectedId || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Busdev/AE updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-neutral-800">Busdev/AE</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Edit AE"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="">Unassigned</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSelectedId(sales?.id ?? ""); setEditing(false) }}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <X className="h-3 w-3" />Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
              className="gap-1 h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3" />{saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-accent-700">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-800">{sales?.name ?? "Unassigned"}</p>
            <p className="text-xs text-neutral-500">Busdev/AE</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoString: string | null): string {
  if (!isoString) return "—"
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const REVENUE_VISIBLE_STAGES: PipelineStage[] = [
  "closed_won",
  "invoiced",
  "contract_renewal",
]

// ── Lead Detail Client (main export) ─────────────────────────────────────────

export interface LeadDetailClientProps {
  lead: SerializedLead
  salesOptions: Array<{ id: string; name: string }>
}

export function LeadDetailClient({ lead, salesOptions }: LeadDetailClientProps) {
  const showActualRevenue = REVENUE_VISIBLE_STAGES.includes(lead.stage)
  const showLossDealReason = lead.stage === "lost_deal"

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      {/* Back link */}
      <Link
        href="/pipeline"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <span className="text-base leading-none">&lsaquo;</span>
        Pipeline
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-neutral-900">{lead.client.name}</h1>
          {lead.client.customerCode && (
            <code className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-100 text-neutral-600 border border-neutral-200 tracking-wider">
              {lead.client.customerCode}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <PipelineStageBadge stage={lead.stage} />
          <span className="text-sm text-neutral-400">{PRODUCT_LINE_LABELS[lead.productLine]}</span>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left — col-span-2 */}
        <div className="col-span-2 space-y-6">
          {/* Lead Details */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold text-neutral-800 mb-4">Lead Details</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Client
                </p>
                <Link
                  href={`/clients/${lead.clientId}`}
                  className="text-sm text-accent-600 hover:text-accent-700 hover:underline transition-colors"
                >
                  {lead.client.name}
                </Link>
              </div>

              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Product Line
                </p>
                <p className="text-sm text-neutral-800">{PRODUCT_LINE_LABELS[lead.productLine]}</p>
              </div>

              <DescriptionInline leadId={lead.id} initialValue={lead.description} />

              <ProjectTypeInline leadId={lead.id} initialValue={lead.projectType} />

              <ProjectedRevenueInline leadId={lead.id} initialValue={lead.projectedRevenue} />

              <BillingPlanInline leadId={lead.id} initialValue={lead.billingPlan} />

              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Quarter
                </p>
                <p className="text-sm text-neutral-800">{lead.quarter ?? "—"}</p>
              </div>

              {showActualRevenue && (
                <ActualRevenueInline leadId={lead.id} initialValue={lead.actualRevenue} />
              )}

              {showLossDealReason && lead.lossDealReason && (
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                    Loss Deal Reason
                  </p>
                  <p className="text-sm text-neutral-800">{lead.lossDealReason}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Created
                </p>
                <p className="text-sm text-neutral-800">{formatDate(lead.createdAt)}</p>
              </div>

              {lead.expectedCloseDate && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                    Expected Close
                  </p>
                  <p className="text-sm text-neutral-800">{formatDate(lead.expectedCloseDate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <DocumentsCard leadId={lead.id} initialDocuments={lead.documents} />

          {/* Notes */}
          <NotesInline leadId={lead.id} initialNotes={lead.notes} />
        </div>

        {/* Right — col-span-1 */}
        <div className="space-y-6">
          {/* Stage History */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold text-neutral-800 mb-4">Stage History</h2>
            <StageHistoryTimeline history={lead.stageHistory} />
          </div>

          {/* Change History */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
            <h2 className="font-semibold text-neutral-800 mb-4">Change History</h2>
            <FieldHistoryTimeline history={lead.fieldHistory} />
          </div>

          {/* AE / Sales */}
          <AeCard leadId={lead.id} sales={lead.sales} salesOptions={salesOptions} />
        </div>
      </div>
    </main>
  )
}

// ── Delete Lead button (admin only) ──────────────────────────────────────────

interface DeleteLeadButtonProps {
  leadId: string
}

function DeleteLeadButton({ leadId }: DeleteLeadButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to delete lead")
      }
      toast.success("Lead dihapus")
      router.push("/pipeline")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-danger-600 hover:text-danger-700 hover:bg-danger-50"
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Delete lead"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Lead
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Lead ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-500 hover:bg-danger-700 text-white"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menghapus...
                </span>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Topbar actions (exported separately for use in server page) ───────────────

export interface LeadDetailActionsProps {
  leadId: string
  stage: PipelineStage
  userRole: "admin" | "account"
}

export function LeadDetailActions({ leadId, stage, userRole }: LeadDetailActionsProps) {
  return (
    <>
      <StageActions leadId={leadId} stage={stage} />
      {userRole === "admin" && <DeleteLeadButton leadId={leadId} />}
    </>
  )
}
