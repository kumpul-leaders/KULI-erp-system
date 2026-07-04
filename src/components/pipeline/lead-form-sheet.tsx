"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PipelineStage, ProductLine, ProjectType } from "@/types"
import { generateBillingPlanRange, billingPlanToLabel } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string
  name: string
  customerCode: string | null
}

interface SalesOption {
  id: string
  name: string
}

export interface LeadFormInitialValues {
  clientId?: string
  clientName?: string
  customerCode?: string
  productLine?: string
  projectedRevenue?: string
  stage?: string
  /** If set, POST body will include renewedFromLeadId */
  renewedFromLeadId?: string
}

interface LeadFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  salesOptions: SalesOption[]
  /** Pre-fill form fields — used for renewal flow. Non-breaking: defaults to empty */
  initialValues?: LeadFormInitialValues
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_LINE_OPTIONS: { value: ProductLine; label: string }[] = [
  { value: "brand_placement", label: "Brand Placement" },
  { value: "speakership", label: "Speakership" },
  { value: "community_event", label: "Community Event" },
  { value: "commissioned_event", label: "Commissioned Event" },
  { value: "others", label: "Others" },
]

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "one_time", label: "One-time" },
  { value: "retainer", label: "Retainer" },
]

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "pipeline", label: "Pipeline" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "lost_deal", label: "Lost Deal" },
  { value: "invoiced", label: "Invoiced" },
  { value: "contract_renewal", label: "Contract Renewal" },
]

// ── billingPlan → quarter ────────────────────────────────────────────────────

function billingPlanToQuarter(billingPlan: string): string | null {
  const match = billingPlan.match(/^(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = 2000 + parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  if (month < 1 || month > 12) return null
  const q = Math.ceil(month / 3)
  return `Q${q} ${year}`
}

// ── Client Combobox ──────────────────────────────────────────────────────────
// Inline combobox — searches clients by name via API.

interface ClientComboboxProps {
  value: string
  onSelect: (client: ClientOption) => void
  error?: string
}

function ClientCombobox({ value, onSelect, error }: ClientComboboxProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<ClientOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }

    const timeout = setTimeout(() => {
      setLoading(true)
      fetch(`/api/clients?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: { clients?: ClientOption[] }) => {
          setResults(data.clients ?? [])
          setOpen(true)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search client name..."
        className={error ? "border-danger-500" : ""}
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-xs text-neutral-400">
          Searching...
        </div>
      )}
      {open && query.length < 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-card shadow-dropdown px-3 py-2.5">
          <p className="text-xs text-neutral-400">Ketik minimal 2 karakter untuk mencari client</p>
        </div>
      )}
      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-card shadow-dropdown px-3 py-3">
          <p className="text-sm text-neutral-600">
            Tidak ditemukan client &ldquo;{query}&rdquo;.
          </p>
          <a
            href="/clients"
            className="mt-1 inline-block text-xs font-medium text-accent-600 hover:text-accent-700"
          >
            Daftarkan client baru →
          </a>
        </div>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-card shadow-dropdown overflow-hidden">
          {results.map((client) => (
            <button
              key={client.id}
              type="button"
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                setQuery(client.name)
                setOpen(false)
                onSelect(client)
              }}
            >
              <span className="text-sm text-neutral-800">{client.name}</span>
              {client.customerCode && (
                <code className="text-xs text-neutral-400 font-mono">
                  {client.customerCode}
                </code>
              )}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger-500">{error}</p>}
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────────

interface FormState {
  clientId: string
  clientName: string
  customerCode: string
  productLine: ProductLine | ""
  description: string
  projectType: ProjectType | ""
  salesId: string
  stage: PipelineStage
  projectedRevenue: string
  billingPlan: string
  expectedCloseDate: string
  notes: string
}

const INITIAL_FORM: FormState = {
  clientId: "",
  clientName: "",
  customerCode: "",
  productLine: "",
  description: "",
  projectType: "",
  salesId: "",
  stage: "leads",
  projectedRevenue: "",
  billingPlan: "",
  expectedCloseDate: "",
  notes: "",
}

export function LeadFormSheet({
  open,
  onOpenChange,
  salesOptions,
  initialValues,
}: LeadFormSheetProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL_FORM,
    ...(initialValues
      ? {
          clientId: initialValues.clientId ?? "",
          clientName: initialValues.clientName ?? "",
          customerCode: initialValues.customerCode ?? "",
          productLine: (initialValues.productLine as FormState["productLine"]) ?? "",
          projectedRevenue: initialValues.projectedRevenue ?? "",
          stage: (initialValues.stage as FormState["stage"]) ?? "leads",
        }
      : {}),
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [billingPlanEnd, setBillingPlanEnd] = useState("")
  const [billingPlanEndError, setBillingPlanEndError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [previewItems, setPreviewItems] = useState<Array<{
    billingPlan: string
    label: string
    quarter: string | null
  }> | null>(null)

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        ...INITIAL_FORM,
        ...(initialValues
          ? {
              clientId: initialValues.clientId ?? "",
              clientName: initialValues.clientName ?? "",
              customerCode: initialValues.customerCode ?? "",
              productLine: (initialValues.productLine as FormState["productLine"]) ?? "",
              projectedRevenue: initialValues.projectedRevenue ?? "",
              stage: (initialValues.stage as FormState["stage"]) ?? "leads",
            }
          : {}),
      })
      setErrors({})
      setBillingPlanEnd("")
      setBillingPlanEndError("")
      setPreviewItems(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const quarter = form.billingPlan ? billingPlanToQuarter(form.billingPlan) : null

  function handleField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}
    let endError = ""

    if (!form.clientId) newErrors.clientId = "Select a client"
    if (!form.productLine) newErrors.productLine = "Product line is required"
    if (!form.projectType) newErrors.projectType = "Project type is required"
    if (form.billingPlan && !/^\d{2}-\d{2}$/.test(form.billingPlan)) {
      newErrors.billingPlan = "Format must be YY-MM (e.g. 26-08)"
    }

    // Recurring range validation — only when projectType is retainer
    if (form.projectType === "retainer" && billingPlanEnd) {
      if (!/^\d{2}-\d{2}$/.test(billingPlanEnd)) {
        endError = "Format must be YY-MM (e.g. 26-08)"
      } else {
        // Check end >= start (only if start is also valid)
        if (form.billingPlan && /^\d{2}-\d{2}$/.test(form.billingPlan)) {
          const range = generateBillingPlanRange(form.billingPlan, billingPlanEnd)
          if (range.length === 0) {
            endError = "Sampai bulan harus sama atau setelah mulai bulan"
          } else if (range.length > 36) {
            endError = "Maksimal 36 bulan"
          }
        }
      }
    }

    setErrors(newErrors)
    setBillingPlanEndError(endError)
    return Object.keys(newErrors).length === 0 && endError === ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const isRecurring =
      form.projectType === "retainer" &&
      form.billingPlan &&
      billingPlanEnd

    if (isRecurring) {
      // Show preview instead of submitting immediately
      const billingPlans = generateBillingPlanRange(form.billingPlan, billingPlanEnd)
      setPreviewItems(
        billingPlans.map((bp) => ({
          billingPlan: bp,
          label: billingPlanToLabel(bp),
          quarter: billingPlanToQuarter(bp),
        }))
      )
      return
    }

    // Single lead — submit directly
    setSubmitting(true)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          productLine: form.productLine,
          description: form.description || null,
          projectType: form.projectType,
          stage: form.stage,
          salesId: form.salesId || null,
          projectedRevenue: form.projectedRevenue
            ? Number(form.projectedRevenue)
            : null,
          billingPlan: form.billingPlan || null,
          expectedCloseDate: form.expectedCloseDate || null,
          notes: form.notes || null,
          ...(initialValues?.renewedFromLeadId
            ? { renewedFromLeadId: initialValues.renewedFromLeadId }
            : {}),
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create lead")
      }

      toast.success("Lead created successfully")
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmBulkCreate() {
    if (!previewItems) return
    const billingPlans = previewItems.map((p) => p.billingPlan)
    setSubmitting(true)
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          productLine: form.productLine,
          description: form.description || null,
          projectType: form.projectType,
          stage: form.stage,
          salesId: form.salesId || null,
          projectedRevenue: form.projectedRevenue ? Number(form.projectedRevenue) : null,
          billingPlans,
          expectedCloseDate: form.expectedCloseDate || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create leads")
      }
      const data = (await res.json()) as { count: number }
      toast.success(`${data.count} leads berhasil dibuat`)
      setPreviewItems(null)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={previewItems !== null} onOpenChange={(isOpen) => { if (!isOpen) setPreviewItems(null) }}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Konfirmasi Bulk Lead</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-neutral-500 px-1">
          Akan membuat{" "}
          <span className="font-semibold text-neutral-800">{previewItems?.length} leads</span>{" "}
          untuk {form.clientName}:
        </p>
        <div className="flex-1 overflow-y-auto border border-neutral-100 rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">#</th>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">Bulan</th>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">Quarter</th>
              </tr>
            </thead>
            <tbody>
              {previewItems?.map((item, i) => (
                <tr key={item.billingPlan} className="border-t border-neutral-50">
                  <td className="px-3 py-1.5 text-neutral-400">{i + 1}</td>
                  <td className="px-3 py-1.5 text-neutral-800 font-medium">{item.label}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{item.quarter ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPreviewItems(null)} disabled={submitting}>
            Kembali
          </Button>
          <Button onClick={confirmBulkCreate} disabled={submitting}>
            {submitting ? "Membuat..." : `Buat ${previewItems?.length ?? 0} Leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>
            {initialValues?.renewedFromLeadId ? "Buat Renewal Lead" : "New Lead"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client — Combobox */}
          <div className="space-y-1.5">
            <Label>
              Client <span className="text-danger-500">*</span>
            </Label>
            <ClientCombobox
              value={form.clientName}
              onSelect={(client) => {
                setForm((prev) => ({
                  ...prev,
                  clientId: client.id,
                  clientName: client.name,
                  customerCode: client.customerCode ?? "",
                }))
                setErrors((prev) => ({ ...prev, clientId: undefined }))
              }}
              error={errors.clientId}
            />
          </div>

          {/* Customer Code — read-only */}
          {form.customerCode && (
            <div className="space-y-1.5">
              <Label>Customer Code</Label>
              <div className="flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-neutral-50">
                <code className="text-sm font-mono text-neutral-600">
                  {form.customerCode}
                </code>
              </div>
            </div>
          )}

          {/* Product Line */}
          <div className="space-y-1.5">
            <Label>
              Product Line <span className="text-danger-500">*</span>
            </Label>
            <Select
              value={form.productLine}
              onValueChange={(v) => handleField("productLine", v)}
            >
              <SelectTrigger
                className={errors.productLine ? "border-danger-500" : ""}
              >
                <SelectValue placeholder="Select product line" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_LINE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productLine && (
              <p className="text-xs text-danger-500">{errors.productLine}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Project Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => handleField("description", e.target.value)}
              rows={2}
              placeholder="Brief description of the project..."
            />
          </div>

          {/* Project Type */}
          <div className="space-y-1.5">
            <Label>
              Project Type <span className="text-danger-500">*</span>
            </Label>
            <Select
              value={form.projectType}
              onValueChange={(v) => handleField("projectType", v)}
            >
              <SelectTrigger
                className={errors.projectType ? "border-danger-500" : ""}
              >
                <SelectValue placeholder="Select project type" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectType && (
              <p className="text-xs text-danger-500">{errors.projectType}</p>
            )}
          </div>

          {/* Sales */}
          <div className="space-y-1.5">
            <Label>Sales</Label>
            <Select
              value={form.salesId || "none"}
              onValueChange={(v) => handleField("salesId", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign sales person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {salesOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => handleField("stage", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Projected Revenue */}
          <div className="space-y-1.5">
            <Label>Projected Revenue (IDR)</Label>
            <Input
              type="number"
              value={form.projectedRevenue}
              onChange={(e) => handleField("projectedRevenue", e.target.value)}
              min={0}
              placeholder="0"
            />
          </div>

          {/* Billing Plan — single (non-retainer) or recurring range (retainer) */}
          {form.projectType !== "retainer" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Billing Plan</Label>
                <Input
                  value={form.billingPlan}
                  onChange={(e) => handleField("billingPlan", e.target.value)}
                  placeholder="YY-MM (e.g. 26-08)"
                  className={errors.billingPlan ? "border-danger-500" : ""}
                />
                {errors.billingPlan && (
                  <p className="text-xs text-danger-500">{errors.billingPlan}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Quarter</Label>
                <div className="flex items-center h-9 px-3 rounded-md border border-neutral-200 bg-neutral-50">
                  <span className="text-sm text-neutral-500">
                    {quarter ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Recurring Billing Range</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-500 font-normal">
                    Mulai Bulan
                  </Label>
                  <Input
                    value={form.billingPlan}
                    onChange={(e) => handleField("billingPlan", e.target.value)}
                    placeholder="YY-MM (e.g. 26-08)"
                    className={errors.billingPlan ? "border-danger-500" : ""}
                  />
                  {errors.billingPlan && (
                    <p className="text-xs text-danger-500">{errors.billingPlan}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-500 font-normal">
                    Sampai Bulan
                  </Label>
                  <Input
                    value={billingPlanEnd}
                    onChange={(e) => {
                      setBillingPlanEnd(e.target.value)
                      setBillingPlanEndError("")
                    }}
                    placeholder="YY-MM (e.g. 26-08)"
                    className={billingPlanEndError ? "border-danger-500" : ""}
                  />
                  {billingPlanEndError && (
                    <p className="text-xs text-danger-500">{billingPlanEndError}</p>
                  )}
                </div>
              </div>
              {/* Range preview */}
              {(() => {
                if (!form.billingPlan || !billingPlanEnd) return null
                if (
                  !/^\d{2}-\d{2}$/.test(form.billingPlan) ||
                  !/^\d{2}-\d{2}$/.test(billingPlanEnd)
                )
                  return null
                const range = generateBillingPlanRange(form.billingPlan, billingPlanEnd)
                if (range.length === 0) return null
                const startLabel = billingPlanToLabel(range[0])
                const endLabel = billingPlanToLabel(range[range.length - 1])
                return (
                  <p className="text-xs text-neutral-500">
                    Akan membuat{" "}
                    <span className="font-medium text-neutral-700">
                      {range.length} leads
                    </span>
                    {" · "}
                    {startLabel} – {endLabel}
                  </p>
                )
              })()}
            </div>
          )}

          {/* Expected Close Date */}
          <div className="space-y-1.5">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => handleField("expectedCloseDate", e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes..."
            />
          </div>

          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Lead"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
    </>
  )
}
