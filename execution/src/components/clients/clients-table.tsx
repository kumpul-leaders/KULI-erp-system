"use client"

import { useState, useCallback, useTransition, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FilterPanel, applyConditions, type FilterCondition, type MatchMode, type FieldConfig } from "@/components/ui/filter-panel"
import { ClientStatusBadge } from "@/components/clients/client-status-badge"
import { AddClientSheet } from "@/components/clients/add-client-sheet"
import { EditClientSheet } from "@/components/clients/edit-client-sheet"
import { formatIDR, cn } from "@/lib/utils"
import type { HealthStatus, EngagementType, ClientStatus } from "@/types"

// ── Types ────────────────────────────────────────────────────────────────────

interface AeOption {
  id: string
  name: string
}

interface ClientRow {
  id: string
  name: string
  customerCode: string | null
  industry: string | null
  orgSize: string | null
  engagementType: EngagementType
  contractStart: string | null
  contractEnd: string | null
  monthlyValue: number | null
  annualValue: number | null
  healthStatus: HealthStatus
  clientStatus: ClientStatus | null
  primaryAe: string | null
  notes: string | null
  ae: { id: string; name: string } | null
  _contactCount: number
  createdAt: string
  updatedAt: string
  cumulativeValue: number
  opportunityValue: number
}

interface ClientsTableProps {
  initialClients: ClientRow[]
  initialTotal: number
  aeOptions: AeOption[]
  searchQuery: string
  sortCol: string
  sortDir: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getContractUrgency(contractEnd: string | null): "critical" | "warning" | null {
  if (!contractEnd) return null
  const daysLeft = Math.ceil((new Date(contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 30) return "critical"
  if (daysLeft <= 60) return "warning"
  return null
}

function useDebounce(fn: (val: string) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  return (val: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(val), delay)
  }
}

// ── Sortable Column Header ────────────────────────────────────────────────────

interface SortableHeaderProps {
  label: string
  col: string
  currentSort: string
  currentDir: string
  onSort: (col: string) => void
  filter?: React.ReactNode
  className?: string
}

function SortableHeader({
  label,
  col,
  currentSort,
  currentDir,
  onSort,
  filter,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === col

  return (
    <TableHead className={cn("font-semibold text-neutral-600", className)}>
      <span className="inline-flex items-center gap-1">
        <button
          className="inline-flex items-center gap-1 group hover:text-neutral-800 transition-colors"
          onClick={() => onSort(col)}
        >
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
        </button>
        {filter}
      </span>
    </TableHead>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ClientsTable({
  initialClients,
  initialTotal,
  aeOptions,
  searchQuery,
  sortCol,
  sortDir,
}: ClientsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editSheetClient, setEditSheetClient] = useState<ClientRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filter panel state
  const [conditions, setConditions] = useState<FilterCondition[]>([])
  const [matchMode, setMatchMode] = useState<MatchMode>("all")

  // ── URL-driven sort updates ─────────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  function handleSort(col: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (sortCol === col) {
      const nextDir = sortDir === "asc" ? "desc" : "asc"
      params.set("sort", col)
      params.set("dir", nextDir)
    } else {
      params.set("sort", col)
      params.delete("dir")
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    useDebounce((val: string) => updateParam("search", val), 350),
    [searchParams, pathname]
  )

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setDeleting(false)
    }
  }

  // ── Field configs for filter panel ─────────────────────────────────────────

  const clientFieldConfigs = useMemo((): FieldConfig[] => [
    { key: "name",           label: "Client Name",       type: "text" },
    { key: "industry",       label: "Industry",          type: "text" },
    { key: "healthStatus",   label: "Health Status",     type: "enum",
      options: [
        { value: "healthy",  label: "Healthy" },
        { value: "at_risk",  label: "At Risk" },
        { value: "churned",  label: "Churned" },
      ] },
    { key: "clientStatus",   label: "Client Status",     type: "enum",
      options: [
        { value: "active",   label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "lead",     label: "Lead" },
      ] },
    { key: "orgSize",        label: "Org Size",          type: "enum",
      options: [
        { value: "Small",      label: "Small" },
        { value: "Medium",     label: "Medium" },
        { value: "Large",      label: "Large" },
        { value: "Enterprise", label: "Enterprise" },
      ] },
    { key: "engagementType", label: "Engagement Type",   type: "enum",
      options: [
        { value: "retainer", label: "Retainer" },
        { value: "project",  label: "Project" },
        { value: "both",     label: "Both" },
      ] },
    { key: "primaryAe",      label: "Busdev/AE", type: "enum",
      options: aeOptions.map((a) => ({ value: a.id, label: a.name })) },
    { key: "monthlyValue",     label: "Monthly Value",     type: "numeric" },
    { key: "cumulativeValue",  label: "Cumulative Value",  type: "numeric" },
    { key: "opportunityValue", label: "Opportunity Value", type: "numeric" },
  ], [aeOptions])

  // ── Client-side filtered rows ───────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    if (conditions.length === 0) return initialClients
    return initialClients.filter((c) =>
      applyConditions(c as unknown as Record<string, unknown>, conditions, matchMode)
    )
  }, [initialClients, conditions, matchMode])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            className="pl-8 h-9 w-80"
            placeholder="Search by name, industry, code, AE..."
            defaultValue={searchQuery}
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>

        <FilterPanel
          fields={clientFieldConfigs}
          conditions={conditions}
          matchMode={matchMode}
          onChange={(c, m) => { setConditions(c); setMatchMode(m) }}
        />

        <span className="ml-auto text-sm text-neutral-500 tabular-nums">
          {filteredClients.length}{" "}
          {filteredClients.length === 1 ? "client" : "clients"}
        </span>

        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setAddSheetOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Table */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-neutral-200 bg-white text-center">
          <p className="text-neutral-500 font-medium mb-1">No clients found</p>
          <p className="text-sm text-neutral-400">
            {conditions.length > 0 || searchQuery
              ? "Try adjusting your filters."
              : "Add your first client to get started."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                {/* Client Name */}
                <SortableHeader
                  label="Client Name"
                  col="name"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[18%]"
                />

                {/* Code */}
                <TableHead className="w-[7%] font-semibold text-neutral-600">
                  Code
                </TableHead>

                {/* Industry */}
                <SortableHeader
                  label="Industry"
                  col="industry"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[12%]"
                />

                {/* Status */}
                <TableHead className="w-[9%] font-semibold text-neutral-600">
                  Status
                </TableHead>

                {/* Org Size */}
                <SortableHeader
                  label="Org Size"
                  col="orgSize"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[8%]"
                />

                {/* AE */}
                <SortableHeader
                  label="AE"
                  col="ae"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[12%]"
                />

                {/* Cumulative Value */}
                <SortableHeader
                  label="Cumulative Value"
                  col="cumulativeValue"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[14%] tabular-nums"
                />

                {/* Opportunity Value */}
                <SortableHeader
                  label="Opportunity Value"
                  col="opportunityValue"
                  currentSort={sortCol}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[12%] tabular-nums"
                />

                {/* Actions */}
                <TableHead className="w-[8%] font-semibold text-neutral-600 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => {
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest("[data-actions]")) return
                      router.push(`/clients/${client.id}`)
                    }}
                  >
                    <TableCell className="font-medium text-neutral-800">
                      {client.name}
                    </TableCell>
                    <TableCell>
                      {client.customerCode ? (
                        <code className="px-1.5 py-0.5 rounded text-xs font-mono bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {client.customerCode}
                        </code>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      {client.industry ?? (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.clientStatus} />
                    </TableCell>
                    <TableCell className="text-neutral-600 text-sm">
                      {client.orgSize ?? (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      {client.ae?.name ?? (
                        <span className="text-neutral-400">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-neutral-700">
                      {client.cumulativeValue > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{formatIDR(client.cumulativeValue)}</span>
                          {(() => {
                            const urgency = getContractUrgency(client.contractEnd)
                            if (!urgency) return null
                            const daysLeft = Math.ceil(
                              (new Date(client.contractEnd!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                            )
                            return (
                              <span className={cn("text-xs font-medium", urgency === "critical" ? "text-danger-600" : "text-amber-600")}>
                                Expiry {daysLeft}d
                              </span>
                            )
                          })()}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-neutral-400">—</span>
                          {(() => {
                            const urgency = getContractUrgency(client.contractEnd)
                            if (!urgency) return null
                            const daysLeft = Math.ceil(
                              (new Date(client.contractEnd!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                            )
                            return (
                              <span className={cn("text-xs font-medium", urgency === "critical" ? "text-danger-600" : "text-amber-600")}>
                                Expiry {daysLeft}d
                              </span>
                            )
                          })()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-neutral-700">
                      {client.opportunityValue > 0 ? formatIDR(client.opportunityValue) : <span className="text-neutral-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right" data-actions>
                      <div
                        className="flex items-center justify-end gap-1"
                        data-actions
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-actions
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditSheetClient(client)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit {client.name}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-danger-500 hover:text-danger-700 hover:bg-danger-50"
                          data-actions
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(client)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete {client.name}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Client Sheet */}
      <AddClientSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        aeOptions={aeOptions}
        onSuccess={() => router.refresh()}
      />

      {/* Edit Client Sheet */}
      {editSheetClient && (
        <EditClientSheet
          open={editSheetClient !== null}
          onOpenChange={(open) => {
            if (!open) setEditSheetClient(null)
          }}
          client={editSheetClient}
          aeOptions={aeOptions}
          onSuccess={() => {
            router.refresh()
            setEditSheetClient(null)
          }}
        />
      )}

      {/* Delete Alert Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? This will also delete all associated contacts and upsell
              opportunities. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-500 hover:bg-danger-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
