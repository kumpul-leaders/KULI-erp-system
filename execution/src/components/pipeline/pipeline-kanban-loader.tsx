"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FilterPanel, applyConditions, type FilterCondition, type MatchMode, type FieldConfig } from "@/components/ui/filter-panel"
import { PipelineKanban, type KanbanSortKey } from "./pipeline-kanban"
import { PipelineListView } from "./pipeline-list-view"
import { LeadFormSheet } from "./lead-form-sheet"
import { cn } from "@/lib/utils"
import type { SerializedLead, KanbanField } from "./pipeline-card"
import type { PipelineStage, ProductLine } from "@/types"

// ── Constants ─────────────────────────────────────────────────────────────────

interface SalesOption {
  id: string
  name: string
}

const STAGE_OPTIONS: Array<{ value: PipelineStage; label: string }> = [
  { value: "leads", label: "Leads" },
  { value: "pipeline", label: "Pipeline" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "lost_deal", label: "Lost Deal" },
  { value: "invoiced", label: "Invoiced" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "no_response", label: "No Response" },
]

const PRODUCT_LINE_OPTIONS: Array<{ value: ProductLine; label: string }> = [
  { value: "stracomm", label: "Stracomm" },
  { value: "smm", label: "SMM" },
  { value: "creative_strategy", label: "Creative Strategy" },
  { value: "media_buying", label: "Media Buying" },
  { value: "ads_management", label: "Ads Management" },
  { value: "production", label: "Production" },
  { value: "others", label: "Others" },
]

// ── Kanban field options ──────────────────────────────────────────────────────

const KANBAN_FIELD_OPTIONS: Array<{ value: KanbanField; label: string }> = [
  { value: "code", label: "Customer Code" },
  { value: "productLine", label: "Product Line" },
  { value: "revenue", label: "Revenue & Quarter" },
  { value: "ae", label: "Busdev/AE" },
  { value: "gateWarning", label: "Gate Warnings" },
  { value: "billingPlan", label: "Billing Plan" },
]

// ── Kanban sort options ───────────────────────────────────────────────────────

const KANBAN_SORT_OPTIONS: Array<{ value: KanbanSortKey; label: string }> = [
  { value: "default", label: "Default order" },
  { value: "revenue_desc", label: "Revenue: High → Low" },
  { value: "revenue_asc", label: "Revenue: Low → High" },
  { value: "name_asc", label: "Company: A → Z" },
  { value: "quarter", label: "Quarter" },
  { value: "created_desc", label: "Newest first" },
]

// ── Lead value accessor ───────────────────────────────────────────────────────

function getLeadValue(lead: SerializedLead, key: string): unknown {
  if (key === "clientName") return lead.client.name
  return (lead as unknown as Record<string, unknown>)[key]
}

// ── Main Component ────────────────────────────────────────────────────────────

interface PipelineKanbanLoaderProps {
  filterParam?: string
}

export function PipelineKanbanLoader({ filterParam }: PipelineKanbanLoaderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [leads, setLeads] = useState<SerializedLead[]>([])
  const [salesOptions, setSalesOptions] = useState<SalesOption[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(searchParams.get("new") === "1")

  // View + filter state
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list")
  const [search, setSearch] = useState("")

  const initialConditions = useMemo(() => {
    if (!filterParam) return []
    try {
      return JSON.parse(atob(filterParam)) as FilterCondition[]
    } catch {
      return []
    }
  }, [filterParam])

  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions)
  const [matchMode, setMatchMode] = useState<MatchMode>("all")

  // Kanban field visibility — default matches original card layout
  const [visibleFields, setVisibleFields] = useState<Set<KanbanField>>(
    new Set<KanbanField>(["productLine", "revenue", "ae", "gateWarning"])
  )

  // Kanban sort
  const [kanbanSort, setKanbanSort] = useState<KanbanSortKey>("default")

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [leadsRes, usersRes] = await Promise.all([
          fetch("/api/leads"),
          fetch("/api/users"),
        ])

        if (!cancelled) {
          const leadsData = (await leadsRes.json()) as { leads: SerializedLead[] }
          const usersData = (await usersRes.json()) as {
            users: Array<{ id: string; name: string; role: string }>
          }

          const salesUsers = usersData.users.filter(
            (u) => u.role === "account" || u.role === "admin"
          )

          setLeads(leadsData.leads ?? [])
          setSalesOptions(salesUsers)
        }
      } catch (err) {
        console.error("[PipelineKanbanLoader]", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  // Sync filter conditions to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (conditions.length > 0) {
      params.set("filter", btoa(JSON.stringify(conditions)))
    } else {
      params.delete("filter")
    }
    router.replace(`/pipeline?${params.toString()}`, { scroll: false })
  }, [conditions]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refetchLeads() {
    try {
      const res = await fetch("/api/leads")
      const data = (await res.json()) as { leads: SerializedLead[] }
      setLeads(data.leads ?? [])
    } catch {
      // silent — board still shows stale data
    }
  }

  function handleSheetChange(open: boolean) {
    setSheetOpen(open)
    if (!open) {
      if (searchParams.get("new") === "1") {
        router.replace("/pipeline")
      }
      void refetchLeads()
    }
  }

  // ── Pipeline field configs (dynamic — depends on salesOptions) ──────────────

  const pipelineFieldConfigs = useMemo((): FieldConfig[] => [
    { key: "clientName",       label: "Client Name",       type: "text" },
    { key: "stage",            label: "Stage",             type: "enum", options: STAGE_OPTIONS },
    { key: "productLine",      label: "Product Line",      type: "enum", options: PRODUCT_LINE_OPTIONS },
    { key: "projectType",      label: "Project Type",      type: "enum",
      options: [{ value: "one_time", label: "One Time" }, { value: "retainer", label: "Retainer" }] },
    { key: "salesId",          label: "Busdev/AE", type: "enum",
      options: salesOptions.map((s) => ({ value: s.id, label: s.name })) },
    { key: "projectedRevenue", label: "Projected Revenue", type: "numeric" },
    { key: "actualRevenue",    label: "Actual Revenue",    type: "numeric" },
    { key: "quarter",          label: "Quarter",           type: "text" },
    { key: "billingPlan",      label: "Billing Plan",      type: "text" },
  ], [salesOptions])

  // ── Computed filtered leads ─────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let result = leads
    if (search) {
      result = result.filter((l) =>
        l.client.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (conditions.length > 0) {
      result = result.filter((l) =>
        applyConditions(l as unknown as Record<string, unknown>, conditions, matchMode, (r, k) =>
          getLeadValue(l, k)
        )
      )
    }
    return result
  }, [leads, search, conditions, matchMode])

  if (loading) {
    return null
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            className="pl-8 h-9 w-56"
            placeholder="Search company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Panel */}
        <FilterPanel
          fields={pipelineFieldConfigs}
          conditions={conditions}
          matchMode={matchMode}
          onChange={(c, m) => { setConditions(c); setMatchMode(m) }}
        />

        {/* Spacer + count */}
        <span className="ml-auto text-sm text-neutral-500 tabular-nums">
          {filteredLeads.length}{" "}
          {filteredLeads.length === 1 ? "lead" : "leads"}
        </span>

        {/* Card Fields popover — kanban only */}
        {viewMode === "kanban" && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-neutral-200 bg-white text-neutral-600 text-sm hover:bg-neutral-50 transition-colors">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Card Fields
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="end">
              <p className="text-xs font-medium text-neutral-500 px-2 mb-1.5">
                Show on card
              </p>
              {KANBAN_FIELD_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-neutral-50 cursor-pointer"
                >
                  <Checkbox
                    checked={visibleFields.has(opt.value)}
                    onCheckedChange={(checked) => {
                      setVisibleFields((prev) => {
                        const next = new Set(prev)
                        if (checked) next.add(opt.value)
                        else next.delete(opt.value)
                        return next
                      })
                    }}
                  />
                  <span className="text-sm text-neutral-700">{opt.label}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Kanban sort — kanban only */}
        {viewMode === "kanban" && (
          <Select
            value={kanbanSort}
            onValueChange={(v) => setKanbanSort(v as KanbanSortKey)}
          >
            <SelectTrigger className="h-9 w-44">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-neutral-200 overflow-hidden">
          <button
            className={cn(
              "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
              viewMode === "kanban"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            )}
            onClick={() => setViewMode("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
          <button
            className={cn(
              "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors border-l border-neutral-200",
              viewMode === "list"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 hover:bg-neutral-50"
            )}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>

        {/* Add Lead */}
        <Button size="sm" className="gap-1.5" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Board / List — Fix 1: conditional overflow based on viewMode */}
      <div
        className={cn(
          "flex-1",
          viewMode === "list" ? "overflow-auto" : "overflow-hidden"
        )}
      >
        {viewMode === "kanban" ? (
          <PipelineKanban
            initialLeads={filteredLeads}
            visibleFields={visibleFields}
            sortKey={kanbanSort}
          />
        ) : (
          <PipelineListView
            leads={filteredLeads}
            salesOptions={salesOptions}
            onRefresh={refetchLeads}
          />
        )}
      </div>

      <LeadFormSheet
        open={sheetOpen}
        onOpenChange={handleSheetChange}
        salesOptions={salesOptions}
      />
    </>
  )
}
