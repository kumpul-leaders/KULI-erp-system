"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, CalendarIcon, ArchiveRestore } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { toast } from "sonner"
import { PipelineStageBadge } from "./pipeline-stage-badge"
import { cn, formatIDR } from "@/lib/utils"
import type { SerializedLead } from "./pipeline-card"
import type { ProductLine, PipelineStage } from "@/types"

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineListViewProps {
  leads: SerializedLead[]
  salesOptions: Array<{ id: string; name: string }>
  onRefresh: () => void
  currentPage?: number
  onPageChange?: (page: number) => void
  userRole?: string | null
}

// ── Footer calculator types ───────────────────────────────────────────────────

type CalcMode = "none" | "count" | "sum" | "avg" | "median"

type NumericCol = "projectedRevenue" | "actualRevenue"

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  stracomm: "Stracomm",
  smm: "SMM",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Management",
  production: "Production",
  others: "Others",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
}

function truncate(str: string | null, max: number): string {
  if (!str) return "—"
  return str.length > max ? str.slice(0, max) + "…" : str
}

function median(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function calcDisplay(
  leads: SerializedLead[],
  col: NumericCol,
  mode: CalcMode
): string {
  if (mode === "none") return ""
  const vals = leads
    .map((l) => l[col])
    .filter((v): v is number => v !== null)
  if (mode === "count") return `${vals.length} filled`
  if (vals.length === 0) return "—"
  if (mode === "sum") return formatIDR(vals.reduce((a, b) => a + b, 0))
  if (mode === "avg")
    return formatIDR(vals.reduce((a, b) => a + b, 0) / vals.length)
  if (mode === "median") return formatIDR(median(vals))
  return ""
}

// ── Sortable Column Header ────────────────────────────────────────────────────

interface SortableColHeaderProps {
  label: string
  col: string
  currentSort: string
  currentDir: "asc" | "desc"
  onSort: (col: string) => void
  className?: string
}

function SortableColHeader({
  label,
  col,
  currentSort,
  currentDir,
  onSort,
  className,
}: SortableColHeaderProps) {
  const isActive = currentSort === col

  return (
    <TableHead
      className={cn(
        "font-semibold text-neutral-600 cursor-pointer select-none group whitespace-nowrap",
        className
      )}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-neutral-700" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-neutral-700" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
        )}
      </span>
    </TableHead>
  )
}

// ── Sort logic ────────────────────────────────────────────────────────────────

type SortCol =
  | "client.name"
  | "stage"
  | "productLine"
  | "projectType"
  | "projectedRevenue"
  | "actualRevenue"
  | "probability"
  | "expectedCloseDate"
  | "billingPlan"
  | "quarter"
  | "createdAt"
  | "sales.name"

function sortLeads(
  leads: SerializedLead[],
  col: SortCol,
  dir: "asc" | "desc"
): SerializedLead[] {
  return [...leads].sort((a, b) => {
    let av: string | number | null = null
    let bv: string | number | null = null

    switch (col) {
      case "client.name":
        av = a.client.name
        bv = b.client.name
        break
      case "stage":
        av = a.stage
        bv = b.stage
        break
      case "productLine":
        av = PRODUCT_LINE_LABELS[a.productLine]
        bv = PRODUCT_LINE_LABELS[b.productLine]
        break
      case "projectType":
        av = a.projectType
        bv = b.projectType
        break
      case "projectedRevenue":
        av = a.projectedRevenue
        bv = b.projectedRevenue
        break
      case "actualRevenue":
        av = a.actualRevenue
        bv = b.actualRevenue
        break
      case "probability":
        av = a.probability
        bv = b.probability
        break
      case "expectedCloseDate":
        av = a.expectedCloseDate
        bv = b.expectedCloseDate
        break
      case "billingPlan":
        av = a.billingPlan
        bv = b.billingPlan
        break
      case "quarter":
        av = a.quarter
        bv = b.quarter
        break
      case "createdAt":
        av = a.createdAt
        bv = b.createdAt
        break
      case "sales.name":
        av = a.sales?.name ?? null
        bv = b.sales?.name ?? null
        break
    }

    // Nulls go last regardless of direction
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    let cmp = 0
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv))
    }

    return dir === "asc" ? cmp : -cmp
  })
}

// ── Stage options ─────────────────────────────────────────────────────────────

const STAGE_OPTIONS: Array<{ value: PipelineStage; label: string }> = [
  { value: "leads",            label: "Leads" },
  { value: "pipeline",         label: "Pipeline" },
  { value: "negotiation",      label: "Negotiation" },
  { value: "closed_won",       label: "Closed Won" },
  { value: "lost_deal",        label: "Lost Deal" },
  { value: "invoiced",         label: "Invoiced" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "no_response",      label: "No Response" },
]

// ── InlineStageCellProps ──────────────────────────────────────────────────────

interface InlineStageCellProps {
  leadId: string
  value: PipelineStage
  onSaved: (newStage: PipelineStage) => void
}

function InlineStageCell({ leadId, value, onSaved }: InlineStageCellProps) {
  const [saving, setSaving] = useState(false)

  async function handleChange(newStage: PipelineStage) {
    if (newStage === value) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? "Stage tidak bisa diubah")
        return
      }
      onSaved(newStage)
      toast.success(`Stage diubah ke "${STAGE_OPTIONS.find((s) => s.value === newStage)?.label ?? newStage}"`)
    } catch {
      toast.error("Terjadi kesalahan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="group relative" onClick={(e) => e.stopPropagation()}>
      <Select
        value={value}
        onValueChange={(v) => { void handleChange(v as PipelineStage) }}
        disabled={saving}
      >
        <SelectTrigger
          className={cn(
            "h-7 min-w-[120px] border-transparent bg-transparent text-xs shadow-none",
            "hover:border-neutral-300 hover:bg-background transition-colors",
            "[&>svg]:opacity-0 group-hover:[&>svg]:opacity-100 group-focus-within:[&>svg]:opacity-100"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STAGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── InlineProbabilityCell ─────────────────────────────────────────────────────

interface InlineProbabilityCellProps {
  leadId: string
  value: number | null
  onSaved: (newValue: number | null) => void
}

function InlineProbabilityCell({ leadId, value, onSaved }: InlineProbabilityCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(value !== null ? String(value) : "")
  const [saving, setSaving] = useState(false)
  const cancelledRef = React.useRef(false)

  async function handleSave() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const parsed = inputVal.trim() === "" ? null : Number(inputVal)
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("Probabilitas harus antara 0–100")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probability: parsed }),
      })
      if (!res.ok) throw new Error("Save failed")
      onSaved(parsed)
      setEditing(false)
    } catch {
      // stay in edit mode
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void handleSave()
    if (e.key === "Escape") {
      cancelledRef.current = true
      setInputVal(value !== null ? String(value) : "")
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min={0}
          max={100}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleSave()}
          autoFocus
          disabled={saving}
          className="w-16 h-6 rounded border border-neutral-300 px-1.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="0"
        />
        <span className="text-xs text-neutral-400">%</span>
      </div>
    )
  }

  return (
    <button
      className="group flex items-center gap-1 text-left tabular-nums text-neutral-700 hover:text-neutral-900 transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {value !== null ? (
        <span>{Math.round(value)}%</span>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
      <Pencil className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 opacity-0 group-hover:opacity-100 transition-all" />
    </button>
  )
}

// ── InlineExpectedCloseDateCell ───────────────────────────────────────────────

interface InlineExpectedCloseDateCellProps {
  leadId: string
  value: string | null // ISO datetime or null
  onSaved: (newValue: string | null) => void
}

function InlineExpectedCloseDateCell({
  leadId,
  value,
  onSaved,
}: InlineExpectedCloseDateCellProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [saving, setSaving] = useState(false)

  async function handleSelect(date: Date | undefined) {
    setSelected(date)
    setSaving(true)
    try {
      const expectedCloseDate = date ? format(date, "yyyy-MM-dd") : null
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedCloseDate }),
      })
      if (!res.ok) throw new Error("Save failed")
      // Convert back to ISO string for parent state
      onSaved(date ? date.toISOString() : null)
      setOpen(false)
      toast.success("Close date diperbarui")
    } catch {
      toast.error("Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const displayValue = value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="group flex items-center gap-1 text-left text-neutral-700 hover:text-neutral-900 transition-colors"
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
        >
          {displayValue ? (
            <span className="text-sm">{displayValue}</span>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
          <CalendarIcon className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 opacity-0 group-hover:opacity-100 transition-all" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-neutral-700">Expected Close Date</p>
          {value && (
            <button
              type="button"
              onClick={() => void handleSelect(undefined)}
              className="text-[10px] text-danger-600 hover:underline"
            >
              Hapus
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => { void handleSelect(date) }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ── InlineProjectedRevenueCell ────────────────────────────────────────────────

interface InlineProjectedRevenueCellProps {
  leadId: string
  value: number | null
  onSaved: (newValue: number | null) => void
}

function InlineProjectedRevenueCell({ leadId, value, onSaved }: InlineProjectedRevenueCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(value !== null ? String(value) : "")
  const [saving, setSaving] = useState(false)
  const cancelledRef = React.useRef(false)

  async function handleSave() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const parsed = inputVal.trim() === "" ? null : Number(inputVal)
    if (parsed !== null && isNaN(parsed)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectedRevenue: parsed }),
      })
      if (!res.ok) throw new Error("Save failed")
      onSaved(parsed)
      setEditing(false)
    } catch {
      // stay in edit mode
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") void handleSave()
    if (e.key === "Escape") {
      cancelledRef.current = true
      setInputVal(value !== null ? String(value) : "")
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleSave()}
          autoFocus
          disabled={saving}
          className="w-32 h-6 rounded border border-neutral-300 px-1.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="0"
        />
      </div>
    )
  }

  return (
    <button
      className="group flex items-center gap-1 text-left tabular-nums text-neutral-700 hover:text-neutral-900 transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        setInputVal(value !== null ? String(value) : "")
        setEditing(true)
      }}
    >
      {value !== null ? (
        <span>{formatIDR(value)}</span>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
      <Pencil className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 opacity-0 group-hover:opacity-100 transition-all" />
    </button>
  )
}

// ── ActualRevenueCell — inline edit ──────────────────────────────────────────

interface ActualRevenueCellProps {
  leadId: string
  value: number | null
  onSaved: (newValue: number | null) => void
}

function ActualRevenueCell({ leadId, value, onSaved }: ActualRevenueCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(value !== null ? String(value) : "")
  const [saving, setSaving] = useState(false)
  const cancelledRef = React.useRef(false)

  async function handleSave() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    const parsed = inputVal.trim() === "" ? null : Number(inputVal)
    if (parsed !== null && isNaN(parsed)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualRevenue: parsed }),
      })
      if (!res.ok) throw new Error("Save failed")
      onSaved(parsed)
      setEditing(false)
    } catch {
      // stay in edit mode on error
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") {
      cancelledRef.current = true
      setInputVal(value !== null ? String(value) : "")
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          disabled={saving}
          className="w-28 h-6 rounded border border-neutral-300 px-1.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="0"
        />
      </div>
    )
  }

  return (
    <button
      className="group flex items-center gap-1 text-left tabular-nums text-neutral-700 hover:text-neutral-900 transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      {value !== null ? (
        <span>{formatIDR(value)}</span>
      ) : (
        <span className="text-neutral-400">—</span>
      )}
      <Pencil className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 opacity-0 group-hover:opacity-100 transition-all" />
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineListView({
  leads,
  salesOptions,
  onRefresh,
  currentPage = 1,
  onPageChange,
  userRole,
}: PipelineListViewProps) {
  const router = useRouter()
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const isAdmin = userRole === "admin" || userRole === "commercial_director"

  // Archived leads (admin only)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedLeads, setArchivedLeads] = useState<Array<{ id: string; clientName: string; stage: string; productLine: string | null; createdAt: string }>>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function fetchArchivedLeads() {
    setArchivedLoading(true)
    try {
      const res = await fetch("/api/leads?archived=1")
      if (!res.ok) throw new Error("Failed to fetch archived leads")
      const data = (await res.json()) as { leads?: Array<{ id: string; client: { name: string }; stage: string; productLine: string | null; createdAt: string }> }
      setArchivedLeads(
        (data.leads ?? []).map((l) => ({
          id: l.id,
          clientName: l.client?.name ?? "—",
          stage: l.stage,
          productLine: l.productLine,
          createdAt: l.createdAt,
        }))
      )
    } catch {
      toast.error("Gagal memuat arsip leads")
    } finally {
      setArchivedLoading(false)
    }
  }

  async function handleRestoreLead(leadId: string, clientName: string) {
    setRestoringId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Restore failed")
      }
      toast.success(`Lead ${clientName} dipulihkan`)
      setArchivedLeads((prev) => prev.filter((l) => l.id !== leadId))
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setRestoringId(null)
    }
  }

  function handleToggleArchived() {
    const next = !showArchived
    setShowArchived(next)
    if (next && archivedLeads.length === 0) {
      void fetchArchivedLeads()
    }
  }

  // Footer calculator state — keyed by column name
  const [colCalcs, setColCalcs] = useState<Record<string, CalcMode>>({})

  // Optimistic overrides for inline-edited fields
  const [revenueOverrides, setRevenueOverrides] = useState<Record<string, number | null>>({})
  const [projectedRevenueOverrides, setProjectedRevenueOverrides] = useState<Record<string, number | null>>({})
  const [probabilityOverrides, setProbabilityOverrides] = useState<Record<string, number | null>>({})
  const [closeDateOverrides, setCloseDateOverrides] = useState<Record<string, string | null>>({})
  const [stageOverrides, setStageOverrides] = useState<Record<string, PipelineStage>>({})

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSalesId, setBulkSalesId] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)

  function getCalcMode(col: string): CalcMode {
    return colCalcs[col] ?? "none"
  }

  function cycleCalc(col: string, isNumeric: boolean) {
    const modes: CalcMode[] = isNumeric
      ? ["none", "count", "sum", "avg", "median"]
      : ["none", "count"]
    const current = getCalcMode(col)
    const idx = modes.indexOf(current)
    const next = modes[(idx + 1) % modes.length]
    setColCalcs((prev) => ({ ...prev, [col]: next }))
  }

  function handleSort(col: string) {
    const typedCol = col as SortCol
    if (sortCol === typedCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(typedCol)
      setSortDir("asc")
    }
  }

  async function handleBulkReassign() {
    if (!bulkSalesId || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const res = await fetch("/api/leads/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds), salesId: bulkSalesId }),
      })
      if (!res.ok) throw new Error("Reassign gagal")
      toast.success(`${selectedIds.size} lead berhasil direassign`)
      setSelectedIds(new Set())
      setBulkSalesId("")
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBulkLoading(false)
    }
  }

  const sortedLeads = useMemo(
    () => sortLeads(leads, sortCol, sortDir),
    [leads, sortCol, sortDir]
  )

  // effectiveLeads — full sorted set with optimistic overrides for all inline-edited fields.
  // Used by footer calcs so counts/sums reflect the entire filtered dataset, not just the current page.
  const effectiveLeads = sortedLeads.map((l) => ({
    ...l,
    actualRevenue:
      revenueOverrides[l.id] !== undefined
        ? revenueOverrides[l.id]
        : l.actualRevenue,
    projectedRevenue:
      projectedRevenueOverrides[l.id] !== undefined
        ? projectedRevenueOverrides[l.id]
        : l.projectedRevenue,
  }))

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const pagedLeads = sortedLeads.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  function buildPageRange(current: number, total: number): Array<number | "ellipsis"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const result: Array<number | "ellipsis"> = [1]
    if (current > 3) result.push("ellipsis")
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) result.push(i)
    if (current < total - 2) result.push("ellipsis")
    result.push(total)
    return result
  }

  const pageRange = buildPageRange(safePage, totalPages)

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-neutral-200 bg-card text-center">
        <p className="text-neutral-500 font-medium mb-1">No leads found</p>
        <p className="text-sm text-neutral-400">
          Try adjusting your filters or add a new lead.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Archive toggle — admin only */}
      {isAdmin && (
        <div className="flex justify-end mb-2">
          <Button
            size="sm"
            variant={showArchived ? "default" : "outline"}
            className="gap-1.5"
            onClick={handleToggleArchived}
          >
            <ArchiveRestore className="h-4 w-4" />
            {showArchived ? "Sembunyikan Arsip" : "Tampilkan Arsip"}
          </Button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-2 p-3 rounded-md bg-info-50 border border-info-200">
          <span className="text-sm text-info-700 font-medium">
            {selectedIds.size} lead dipilih
          </span>
          <span className="text-info-300">|</span>
          <span className="text-sm text-info-700">Reassign ke:</span>
          <Select value={bulkSalesId} onValueChange={setBulkSalesId}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Pilih AE..." />
            </SelectTrigger>
            <SelectContent>
              {salesOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!bulkSalesId || bulkLoading}
            onClick={handleBulkReassign}
          >
            {bulkLoading ? "..." : "Terapkan"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-info-600 dark:text-info-500"
            onClick={() => setSelectedIds(new Set())}
          >
            Batalkan
          </Button>
        </div>
      )}

    {/* Fix 1: removed overflow-x-auto — parent wrapper in loader now handles scroll */}
    <div className="rounded-lg border border-neutral-200 bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50">
            {/* Select-all checkbox — selects current page only */}
            <TableHead className="w-[40px]">
              <Checkbox
                checked={pagedLeads.length > 0 && pagedLeads.every((l) => selectedIds.has(l.id))}
                onCheckedChange={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev)
                    if (checked) pagedLeads.forEach((l) => next.add(l.id))
                    else pagedLeads.forEach((l) => next.delete(l.id))
                    return next
                  })
                }}
              />
            </TableHead>
            <SortableColHeader
              label="Company"
              col="client.name"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[160px]"
            />
            <TableHead className="font-semibold text-neutral-600 min-w-[90px]">
              Code
            </TableHead>
            <SortableColHeader
              label="Stage"
              col="stage"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[130px]"
            />
            <SortableColHeader
              label="Prob."
              col="probability"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[80px] tabular-nums"
            />
            <SortableColHeader
              label="Close Date"
              col="expectedCloseDate"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[110px]"
            />
            <SortableColHeader
              label="Busdev/AE"
              col="sales.name"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[110px]"
            />
            <SortableColHeader
              label="Product Line"
              col="productLine"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[140px]"
            />
            <SortableColHeader
              label="Type"
              col="projectType"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[100px]"
            />
            <SortableColHeader
              label="Projected"
              col="projectedRevenue"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[130px] tabular-nums"
            />
            <SortableColHeader
              label="Actual"
              col="actualRevenue"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[130px] tabular-nums"
            />
            <SortableColHeader
              label="Billing Plan"
              col="billingPlan"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[120px]"
            />
            <SortableColHeader
              label="Quarter"
              col="quarter"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[90px]"
            />
            <TableHead className="font-semibold text-neutral-600 min-w-[160px]">
              Notes
            </TableHead>
            <SortableColHeader
              label="Created"
              col="createdAt"
              currentSort={sortCol}
              currentDir={sortDir}
              onSort={handleSort}
              className="min-w-[100px]"
            />
            <TableHead className="font-semibold text-neutral-600 text-right min-w-[70px]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedLeads.map((lead) => (
            <TableRow
              key={lead.id}
              className="cursor-pointer hover:bg-neutral-50 transition-colors"
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.closest("[data-actions]")) return
                router.push(`/pipeline/${lead.id}`)
              }}
            >
              {/* Row checkbox */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={(checked) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (checked) next.add(lead.id)
                      else next.delete(lead.id)
                      return next
                    })
                  }}
                />
              </TableCell>

              {/* Company */}
              <TableCell className="font-medium text-neutral-800">
                <Link
                  href={`/clients/${lead.client.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-info-600 dark:hover:text-info-500 hover:underline transition-colors"
                >
                  {lead.client.name}
                </Link>
              </TableCell>

              {/* Code */}
              <TableCell>
                {lead.client.customerCode ? (
                  <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-neutral-100 text-neutral-700 border border-neutral-200">
                    {lead.client.customerCode}
                  </code>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </TableCell>

              {/* Stage — inline select with gate validation */}
              <TableCell>
                <InlineStageCell
                  leadId={lead.id}
                  value={(stageOverrides[lead.id] ?? lead.stage) as PipelineStage}
                  onSaved={(newStage) =>
                    setStageOverrides((prev) => ({ ...prev, [lead.id]: newStage }))
                  }
                />
              </TableCell>

              {/* Probability — inline number */}
              <TableCell className="tabular-nums">
                <InlineProbabilityCell
                  leadId={lead.id}
                  value={
                    probabilityOverrides[lead.id] !== undefined
                      ? probabilityOverrides[lead.id]
                      : lead.probability
                  }
                  onSaved={(newVal) =>
                    setProbabilityOverrides((prev) => ({ ...prev, [lead.id]: newVal }))
                  }
                />
              </TableCell>

              {/* Expected Close Date — date popover */}
              <TableCell>
                <InlineExpectedCloseDateCell
                  leadId={lead.id}
                  value={
                    closeDateOverrides[lead.id] !== undefined
                      ? closeDateOverrides[lead.id]
                      : lead.expectedCloseDate
                  }
                  onSaved={(newVal) =>
                    setCloseDateOverrides((prev) => ({ ...prev, [lead.id]: newVal }))
                  }
                />
              </TableCell>

              {/* AE */}
              <TableCell className="text-neutral-600 text-sm">
                {lead.sales?.name ?? <span className="text-neutral-400">—</span>}
              </TableCell>

              {/* Product Line */}
              <TableCell>
                <span className="inline-flex items-center rounded-sm bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                  {PRODUCT_LINE_LABELS[lead.productLine]}
                </span>
              </TableCell>

              {/* Project Type */}
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium",
                    lead.projectType === "retainer"
                      ? "bg-info-50 text-info-700 border-info-200"
                      : "bg-neutral-100 text-neutral-600 border-neutral-200"
                  )}
                >
                  {lead.projectType === "retainer" ? "Retainer" : "One Time"}
                </span>
              </TableCell>

              {/* Projected Revenue — inline number */}
              <TableCell className="tabular-nums text-neutral-700">
                <InlineProjectedRevenueCell
                  leadId={lead.id}
                  value={
                    projectedRevenueOverrides[lead.id] !== undefined
                      ? projectedRevenueOverrides[lead.id]
                      : lead.projectedRevenue
                  }
                  onSaved={(newVal) =>
                    setProjectedRevenueOverrides((prev) => ({ ...prev, [lead.id]: newVal }))
                  }
                />
              </TableCell>

              {/* Actual Revenue */}
              <TableCell className="tabular-nums text-neutral-700 min-w-[130px]">
                <ActualRevenueCell
                  leadId={lead.id}
                  value={
                    revenueOverrides[lead.id] !== undefined
                      ? revenueOverrides[lead.id]
                      : lead.actualRevenue
                  }
                  onSaved={(newVal) =>
                    setRevenueOverrides((prev) => ({ ...prev, [lead.id]: newVal }))
                  }
                />
              </TableCell>

              {/* Billing Plan */}
              <TableCell className="text-neutral-600 text-sm">
                {lead.billingPlan ?? <span className="text-neutral-400">—</span>}
              </TableCell>

              {/* Quarter */}
              <TableCell className="text-neutral-600 text-sm font-mono">
                {lead.quarter ?? <span className="text-neutral-400">—</span>}
              </TableCell>

              {/* Notes */}
              <TableCell className="text-neutral-500 text-sm">
                {truncate(lead.notes, 40)}
              </TableCell>

              {/* Created */}
              <TableCell className="text-neutral-500 text-sm">
                {formatDate(lead.createdAt)}
              </TableCell>

              {/* Actions */}
              <TableCell className="text-right" data-actions>
                <div className="flex items-center justify-end gap-1" data-actions>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-actions
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/pipeline/${lead.id}`)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit {lead.client.name}</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        {/* Footer calculator — click cells to cycle calc modes */}
        <TableFooter className="bg-neutral-50">
          <TableRow className="hover:bg-neutral-100 border-t-2 border-neutral-200">
            {/* Checkbox col — empty */}
            <TableCell />

            {/* Company — count */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors",
                  getCalcMode("clientName") === "count"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("clientName", false)}
              >
                {getCalcMode("clientName") === "count"
                  ? `${sortedLeads.length} records`
                  : "Count"}
              </button>
            </TableCell>

            {/* Code — no calc */}
            <TableCell />

            {/* Stage — count */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors",
                  getCalcMode("stage") === "count"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("stage", false)}
              >
                {getCalcMode("stage") === "count"
                  ? `${sortedLeads.length} records`
                  : "Count"}
              </button>
            </TableCell>

            {/* Probability — no calc */}
            <TableCell />

            {/* Close Date — no calc */}
            <TableCell />

            {/* AE — count filled */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors",
                  getCalcMode("ae") === "count"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("ae", false)}
              >
                {getCalcMode("ae") === "count"
                  ? `${sortedLeads.filter((l) => l.sales !== null).length} filled`
                  : "Count"}
              </button>
            </TableCell>

            {/* Product Line — count */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors",
                  getCalcMode("productLine") === "count"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("productLine", false)}
              >
                {getCalcMode("productLine") === "count"
                  ? `${sortedLeads.length} records`
                  : "Count"}
              </button>
            </TableCell>

            {/* Type — no calc */}
            <TableCell />

            {/* Projected Revenue — full calc */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors font-mono tabular-nums",
                  getCalcMode("projectedRevenue") !== "none"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("projectedRevenue", true)}
                title="Click to cycle: Count → Sum → Avg → Median"
              >
                {(() => {
                  const mode = getCalcMode("projectedRevenue")
                  if (mode === "none") return "Calculate"
                  const display = calcDisplay(effectiveLeads, "projectedRevenue", mode)
                  const labels: Record<CalcMode, string> = {
                    none: "",
                    count: "",
                    sum: "Σ",
                    avg: "Avg",
                    median: "Med",
                  }
                  return mode === "count" ? display : `${labels[mode]} ${display}`
                })()}
              </button>
            </TableCell>

            {/* Actual Revenue — full calc (uses effectiveLeads for optimistic overrides) */}
            <TableCell className="py-2">
              <button
                className={cn(
                  "text-xs transition-colors font-mono tabular-nums",
                  getCalcMode("actualRevenue") !== "none"
                    ? "text-neutral-700 font-medium"
                    : "text-neutral-500 hover:text-neutral-700"
                )}
                onClick={() => cycleCalc("actualRevenue", true)}
                title="Click to cycle: Count → Sum → Avg → Median"
              >
                {(() => {
                  const mode = getCalcMode("actualRevenue")
                  if (mode === "none") return "Calculate"
                  const display = calcDisplay(effectiveLeads, "actualRevenue", mode)
                  const labels: Record<CalcMode, string> = {
                    none: "",
                    count: "",
                    sum: "Σ",
                    avg: "Avg",
                    median: "Med",
                  }
                  return mode === "count" ? display : `${labels[mode]} ${display}`
                })()}
              </button>
            </TableCell>

            {/* Billing Plan, Quarter, Notes, Created, Actions — empty */}
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>

    {/* Pagination */}
    {totalPages > 1 && (
      <div className="mt-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); if (safePage > 1) onPageChange?.(safePage - 1) }}
                aria-disabled={safePage <= 1}
                className={safePage <= 1 ? "pointer-events-none opacity-40" : ""}
              />
            </PaginationItem>
            {pageRange.map((item, idx) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === safePage}
                    onClick={(e) => { e.preventDefault(); onPageChange?.(item) }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => { e.preventDefault(); if (safePage < totalPages) onPageChange?.(safePage + 1) }}
                aria-disabled={safePage >= totalPages}
                className={safePage >= totalPages ? "pointer-events-none opacity-40" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    )}

      {/* Archived Leads Section (admin only) */}
      {isAdmin && showArchived && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3">
            Leads Diarsipkan ({archivedLeads.length})
          </h3>
          {archivedLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-md bg-neutral-100 dark:bg-card animate-pulse" />
              ))}
            </div>
          ) : archivedLeads.length === 0 ? (
            <p className="text-sm text-neutral-400">Tidak ada lead yang diarsipkan.</p>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-card shadow-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50 dark:bg-background/50">
                    <TableHead className="font-semibold text-neutral-600 dark:text-neutral-400">Company</TableHead>
                    <TableHead className="font-semibold text-neutral-600 dark:text-neutral-400">Stage</TableHead>
                    <TableHead className="font-semibold text-neutral-600 dark:text-neutral-400">Product Line</TableHead>
                    <TableHead className="w-[120px] font-semibold text-neutral-600 dark:text-neutral-400 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="opacity-60 hover:opacity-80 transition-opacity"
                    >
                      <TableCell className="font-medium text-neutral-600 dark:text-neutral-300">
                        {lead.clientName}
                      </TableCell>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {lead.stage}
                      </TableCell>
                      <TableCell className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {lead.productLine ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          disabled={restoringId === lead.id}
                          onClick={() => void handleRestoreLead(lead.id, lead.clientName)}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          {restoringId === lead.id ? "Memulihkan..." : "Restore"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
