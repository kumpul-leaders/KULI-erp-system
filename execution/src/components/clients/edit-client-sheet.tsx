"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
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
import type { EngagementType, HealthStatus, ClientStatus } from "@/types"

interface AeOption {
  id: string
  name: string
}

// customerCode is present but read-only — not editable
interface ClientForEdit {
  id: string
  name: string
  customerCode?: string | null
  industry?: string | null
  orgSize?: string | null
  engagementType: EngagementType
  contractStart?: Date | string | null
  contractEnd?: Date | string | null
  monthlyValue?: number | null
  annualValue?: number | null
  healthStatus: HealthStatus
  clientStatus?: ClientStatus | null
  primaryAe?: string | null
  notes?: string | null
}

interface EditClientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ClientForEdit
  aeOptions: AeOption[]
  onSuccess: () => void
}

const INDUSTRY_OPTIONS = [
  "Retail FMCG",
  "Internet & Technology",
  "Fashion & Beauty",
  "Finance",
  "Health & Medical",
  "E-Commerce",
  "Service",
  "FnB Horeca",
  "Government",
  "Automotive",
  "Property",
  "SAAS",
]

const ORG_SIZE_OPTIONS = ["1-10", "11-50", "51-200", "201-1000", "1000+"]

function toDateInput(val: Date | string | null | undefined): string {
  if (!val) return ""
  const d = typeof val === "string" ? new Date(val) : val
  return d.toISOString().split("T")[0]
}

export function EditClientSheet({
  open,
  onOpenChange,
  client,
  aeOptions,
  onSuccess,
}: EditClientSheetProps) {
  const [form, setForm] = useState({
    name: client.name,
    industry: client.industry ?? "",
    orgSize: client.orgSize ?? "",
    engagementType: client.engagementType as EngagementType | "",
    contractStart: toDateInput(client.contractStart),
    contractEnd: toDateInput(client.contractEnd),
    monthlyValue: client.monthlyValue?.toString() ?? "",
    annualValue: client.annualValue?.toString() ?? "",
    healthStatus: client.healthStatus as HealthStatus,
    clientStatus: (client.clientStatus ?? "") as ClientStatus | "",
    primaryAe: client.primaryAe ?? "",
    notes: client.notes ?? "",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  // Sync form when client prop changes (e.g. after refetch)
  useEffect(() => {
    setForm({
      name: client.name,
      industry: client.industry ?? "",
      orgSize: client.orgSize ?? "",
      engagementType: client.engagementType,
      contractStart: toDateInput(client.contractStart),
      contractEnd: toDateInput(client.contractEnd),
      monthlyValue: client.monthlyValue?.toString() ?? "",
      annualValue: client.annualValue?.toString() ?? "",
      healthStatus: client.healthStatus,
      clientStatus: (client.clientStatus ?? "") as ClientStatus | "",
      primaryAe: client.primaryAe ?? "",
      notes: client.notes ?? "",
    })
  }, [client])

  function handleField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<string, string>> = {}
    if (!form.name.trim()) newErrors.name = "Client name is required"
    if (!form.engagementType) newErrors.engagementType = "Engagement type is required"
    if (form.contractStart && form.contractEnd) {
      if (new Date(form.contractEnd) <= new Date(form.contractStart)) {
        newErrors.contractEnd = "Contract end must be after contract start"
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry || null,
          orgSize: form.orgSize || null,
          engagementType: form.engagementType,
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
          monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : null,
          annualValue: form.annualValue ? Number(form.annualValue) : null,
          healthStatus: form.healthStatus,
          clientStatus: form.clientStatus,
          primaryAe: form.primaryAe && form.primaryAe !== "none" ? form.primaryAe : null,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update client")
      }

      toast.success("Client updated successfully")
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Edit Client</SheetTitle>
          {client.customerCode && (
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Code:{" "}
              <code className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                {client.customerCode}
              </code>
            </p>
          )}
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">
              Client Name <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => handleField("name", e.target.value)}
            />
            {errors.name && (
              <p className="text-xs text-danger-500">{errors.name}</p>
            )}
          </div>

          {/* Client Status + Org Size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Status</Label>
              <Select
                value={form.clientStatus}
                onValueChange={(v) => handleField("clientStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Org Size</Label>
              <Select
                value={form.orgSize || "none"}
                onValueChange={(v) => handleField("orgSize", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {ORG_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select
              value={form.industry || "none"}
              onValueChange={(v) => handleField("industry", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {INDUSTRY_OPTIONS.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Engagement Type */}
          <div className="space-y-1.5">
            <Label>Engagement Type <span className="text-danger-500">*</span></Label>
            <Select
              value={form.engagementType}
              onValueChange={(v) => handleField("engagementType", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retainer">Retainer</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            {errors.engagementType && (
              <p className="text-xs text-danger-500">{errors.engagementType}</p>
            )}
          </div>

          {/* Contract Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Contract Start</Label>
              <Input
                id="edit-start"
                type="date"
                value={form.contractStart}
                onChange={(e) => handleField("contractStart", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">Contract End</Label>
              <Input
                id="edit-end"
                type="date"
                value={form.contractEnd}
                onChange={(e) => handleField("contractEnd", e.target.value)}
              />
              {errors.contractEnd && (
                <p className="text-xs text-danger-500">{errors.contractEnd}</p>
              )}
            </div>
          </div>

          {/* Contract Values */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-monthly">Monthly Value (IDR)</Label>
              <Input
                id="edit-monthly"
                type="number"
                value={form.monthlyValue}
                onChange={(e) => handleField("monthlyValue", e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-annual">Annual Value (IDR)</Label>
              <Input
                id="edit-annual"
                type="number"
                value={form.annualValue}
                onChange={(e) => handleField("annualValue", e.target.value)}
                min={0}
              />
            </div>
          </div>

          {/* Health Status */}
          <div className="space-y-1.5">
            <Label>Health Status</Label>
            <Select
              value={form.healthStatus}
              onValueChange={(v) => handleField("healthStatus", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Primary AE */}
          <div className="space-y-1.5">
            <Label>Primary AE</Label>
            <Select
              value={form.primaryAe || "none"}
              onValueChange={(v) => handleField("primaryAe", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select AE" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No AE assigned</SelectItem>
                {aeOptions.map((ae) => (
                  <SelectItem key={ae.id} value={ae.id}>
                    {ae.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              rows={4}
              placeholder="Internal notes about this client..."
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
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
