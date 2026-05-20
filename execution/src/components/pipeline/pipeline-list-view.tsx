"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react"
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
import { toast } from "sonner"
import { PipelineStageBadge } from "./pipeline-stage-badge"
import { cn, formatIDR } from "@/lib/utils"
import type { SerializedLead } from "./pipeline-card"
import type { ProductLine } from "@/types"

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineListViewProps {
  leads: SerializedLead[]
  salesOptions: Array<{ id: string; name: string }>
  onRefresh: () => void
}

// ── Footer calculator types ───────────────────────────────────────────────────

type CalcMode = "none" | "count" | "sum" | "avg" | "median"

const NUMERIC_COLS = ["projectedRevenue", "actualRevenue"] as const
type NumericCol = (typeof NUMERIC_COLS)[number]

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
}: PipelineListViewProps) {
  const router = useRouter()
  const [sortCol, setSortCol] = useState<SortCol>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Footer calculator state — keyed by column name
  const [colCalcs, setColCalcs] = useState<Record<string, CalcMode>>({})

  // Optimistic overrides for actual revenue edits
  const [revenueOverrides, setRevenueOverrides] = useState<Record<string, number | null>>({})

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

  // effectiveLeads applies optimistic revenue overrides for footer calculations
  const effectiveLeads = useMemo(
    () =>
      sortedLeads.map((l) => ({
        ...l,
        actualRevenue:
          revenueOverrides[l.id] !== undefined
            ? revenueOverrides[l.id]
            : l.actualRevenue,
      })),
    [sortedLeads, revenueOverrides]
  )

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-neutral-200 bg-white text-center">
        <p className="text-neutral-500 font-medium mb-1">No leads found</p>
        <p className="text-sm text-neutral-400">
          Try adjusting your filters or add a new lead.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-2 p-3 rounded-md bg-blue-50 border border-blue-200">
          <span className="text-sm text-blue-700 font-medium">
            {selectedIds.size} lead dipilih
          </span>
          <span className="text-blue-300">|</span>
          <span className="text-sm text-blue-600">Reassign ke:</span>
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
            className="h-7 text-xs text-blue-600"
            onClick={() => setSelectedIds(new Set())}
          >
            Batalkan
          </Button>
        </div>
      )}

    {/* Fix 1: removed overflow-x-auto — parent wrapper in loader now handles scroll */}
    <div className="rounded-lg border border-neutral-200 bg-white shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50">
            {/* Select-all checkbox */}
            <TableHead className="w-[40px]">
              <Checkbox
                checked={selectedIds.size === sortedLeads.length && sortedLeads.length > 0}
                onCheckedChange={(checked) => {
                  setSelectedIds(checked ? new Set(sortedLeads.map((l) => l.id)) : new Set())
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
          {sortedLeads.map((lead) => (
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
                {lead.client.name}
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

              {/* Stage */}
              <TableCell>
                <PipelineStageBadge stage={lead.stage} />
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

              {/* Projected Revenue */}
              <TableCell className="tabular-nums text-neutral-700">
                {lead.projectedRevenue ? (
                  formatIDR(lead.projectedRevenue)
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
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
                  const display = calcDisplay(sortedLeads, "projectedRevenue", mode)
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
    </div>
  )
}
