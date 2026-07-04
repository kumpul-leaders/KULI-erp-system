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
import { Trash2 } from "lucide-react"
import type { ClientStatus } from "@/types"

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
  officeAddress?: string | null
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
  onDelete?: () => void
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

export function EditClientSheet({
  open,
  onOpenChange,
  client,
  aeOptions,
  onSuccess,
  onDelete,
}: EditClientSheetProps) {
  const [form, setForm] = useState({
    name: client.name,
    industry: client.industry ?? "",
    orgSize: client.orgSize ?? "",
    officeAddress: client.officeAddress ?? "",
    clientStatus: (client.clientStatus ?? "") as ClientStatus | "",
    primaryAe: client.primaryAe ?? "",
    notes: client.notes ?? "",
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [submitting, setSubmitting] = useState(false)

  // Sync form when client prop changes (e.g. after refetch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: client.name,
      industry: client.industry ?? "",
      orgSize: client.orgSize ?? "",
      officeAddress: client.officeAddress ?? "",
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
          officeAddress: form.officeAddress.trim() || null,
          clientStatus: form.clientStatus || null,
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
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-1">
              Code:{" "}
              <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-700 border border-neutral-200 dark:border-neutral-600">
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

          {/* Primary Busdev/AE */}
          <div className="space-y-1.5">
            <Label>Primary Busdev/AE</Label>
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

          {/* Office Address */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-office-address">Office Address</Label>
            <Input
              id="edit-office-address"
              value={form.officeAddress}
              onChange={(e) => handleField("officeAddress", e.target.value)}
              placeholder="Full office address"
            />
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

          <SheetFooter className="pt-4 flex justify-between">
            <div>
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Client
                </Button>
              )}
            </div>
            <div className="flex gap-2">
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
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
