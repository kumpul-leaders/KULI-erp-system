"use client"

import { useState } from "react"
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

interface AddClientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  aeOptions: AeOption[]
  onSuccess: () => void
}

interface FormState {
  name: string
  industry: string
  orgSize: string
  engagementType: EngagementType | ""
  contractStart: string
  contractEnd: string
  monthlyValue: string
  annualValue: string
  healthStatus: HealthStatus | ""
  clientStatus: ClientStatus
  primaryAe: string
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

const initialForm: FormState = {
  name: "",
  industry: "",
  orgSize: "",
  engagementType: "",
  contractStart: "",
  contractEnd: "",
  monthlyValue: "",
  annualValue: "",
  healthStatus: "",
  clientStatus: "lead",
  primaryAe: "",
}

export function AddClientSheet({
  open,
  onOpenChange,
  aeOptions,
  onSuccess,
}: AddClientSheetProps) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  function handleField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {}
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
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry || undefined,
          orgSize: form.orgSize || null,
          engagementType: form.engagementType,
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
          monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : null,
          annualValue: form.annualValue ? Number(form.annualValue) : null,
          healthStatus: form.healthStatus || null,
          clientStatus: form.clientStatus,
          primaryAe: form.primaryAe || null,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to create client")
      }

      toast.success("Client added successfully")
      setForm(initialForm)
      setErrors({})
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
          <SheetTitle>Add Client</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Client Name <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleField("name", e.target.value)}
              placeholder="Client company name"
            />
            {errors.name && (
              <p className="text-xs text-danger-500">{errors.name}</p>
            )}
          </div>

          {/* Client Status + Org Size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Client Status <span className="text-danger-500">*</span>
              </Label>
              <Select
                value={form.clientStatus}
                onValueChange={(v) => handleField("clientStatus", v as ClientStatus)}
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
            <Label>
              Engagement Type <span className="text-danger-500">*</span>
            </Label>
            <Select
              value={form.engagementType}
              onValueChange={(v) => handleField("engagementType", v as EngagementType)}
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
              <Label htmlFor="contractStart">Contract Start</Label>
              <Input
                id="contractStart"
                type="date"
                value={form.contractStart}
                onChange={(e) => handleField("contractStart", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contractEnd">Contract End</Label>
              <Input
                id="contractEnd"
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
              <Label htmlFor="monthlyValue">Monthly Value (IDR)</Label>
              <Input
                id="monthlyValue"
                type="number"
                value={form.monthlyValue}
                onChange={(e) => handleField("monthlyValue", e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="annualValue">Annual Value (IDR)</Label>
              <Input
                id="annualValue"
                type="number"
                value={form.annualValue}
                onChange={(e) => handleField("annualValue", e.target.value)}
                placeholder="0"
                min={0}
              />
            </div>
          </div>

          {/* Health Status */}
          <div className="space-y-1.5">
            <Label>Health Status</Label>
            <Select
              value={form.healthStatus || "none"}
              onValueChange={(v) => handleField("healthStatus", v === "none" ? "" : v as HealthStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Primary Busdev/AE */}
          <div className="space-y-1.5">
            <Label>Primary Busdev/AE</Label>
            <Select
              value={form.primaryAe || "none"}
              onValueChange={(v) => handleField("primaryAe", v === "none" ? "" : v)}
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
              {submitting ? "Adding..." : "Add Client"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
