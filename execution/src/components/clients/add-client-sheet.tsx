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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClientStatus } from "@/types"

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
  // Client fields
  name: string
  clientStatus: ClientStatus
  industry: string
  orgSize: string
  primaryAe: string
  officeAddress: string
  notes: string
  // Primary contact fields
  contactName: string
  contactRole: string
  contactEmail: string
  contactPhone: string
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
  clientStatus: "lead",
  industry: "",
  orgSize: "",
  primaryAe: "",
  officeAddress: "",
  notes: "",
  contactName: "",
  contactRole: "",
  contactEmail: "",
  contactPhone: "",
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
    if (!form.clientStatus) newErrors.clientStatus = "Client status is required"
    if (!form.officeAddress.trim()) newErrors.officeAddress = "Office address is required"
    if (!form.contactName.trim()) newErrors.contactName = "Contact name is required"
    if (!form.contactRole.trim()) newErrors.contactRole = "Contact role is required"
    if (!form.contactEmail.trim()) {
      newErrors.contactEmail = "Contact email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      newErrors.contactEmail = "Invalid email address"
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
          clientStatus: form.clientStatus,
          industry: form.industry || null,
          orgSize: form.orgSize || null,
          primaryAe: form.primaryAe || null,
          officeAddress: form.officeAddress.trim(),
          notes: form.notes.trim() || null,
          initialContact: {
            name: form.contactName.trim(),
            role: form.contactRole.trim(),
            email: form.contactEmail.trim(),
            phone: form.contactPhone.trim() || null,
          },
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

          {/* Client Status + Industry */}
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
              {errors.clientStatus && (
                <p className="text-xs text-danger-500">{errors.clientStatus}</p>
              )}
            </div>
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
          </div>

          {/* Org Size + Primary AE */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {/* Office Address */}
          <div className="space-y-1.5">
            <Label htmlFor="officeAddress">
              Office Address <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="officeAddress"
              value={form.officeAddress}
              onChange={(e) => handleField("officeAddress", e.target.value)}
              placeholder="Full office address"
            />
            {errors.officeAddress && (
              <p className="text-xs text-danger-500">{errors.officeAddress}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              placeholder="Internal notes about this client..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Primary Contact section */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-700">
              Primary Contact
            </p>

            <div className="space-y-4">
              {/* Contact Name */}
              <div className="space-y-1.5">
                <Label htmlFor="contactName">
                  Contact Name <span className="text-danger-500">*</span>
                </Label>
                <Input
                  id="contactName"
                  value={form.contactName}
                  onChange={(e) => handleField("contactName", e.target.value)}
                  placeholder="Full name"
                />
                {errors.contactName && (
                  <p className="text-xs text-danger-500">{errors.contactName}</p>
                )}
              </div>

              {/* Role / Title */}
              <div className="space-y-1.5">
                <Label htmlFor="contactRole">
                  Role / Title <span className="text-danger-500">*</span>
                </Label>
                <Input
                  id="contactRole"
                  value={form.contactRole}
                  onChange={(e) => handleField("contactRole", e.target.value)}
                  placeholder="e.g. Marketing Manager"
                />
                {errors.contactRole && (
                  <p className="text-xs text-danger-500">{errors.contactRole}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="contactEmail">
                  Email <span className="text-danger-500">*</span>
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => handleField("contactEmail", e.target.value)}
                  placeholder="contact@company.com"
                />
                {errors.contactEmail && (
                  <p className="text-xs text-danger-500">{errors.contactEmail}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(e) => handleField("contactPhone", e.target.value)}
                  placeholder="e.g. 08123456789"
                />
              </div>
            </div>
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
