"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { UpsellStatusBadge } from "@/components/clients/upsell-status-badge"
import { formatIDR } from "@/lib/utils"
import type { UpsellStatus } from "@/types"

// ── Types ──────────────────────────────────────────────────────────────────

interface Upsell {
  id: string
  service: string
  status: UpsellStatus
  estimatedValue: number | null
  notes: string | null
  createdAt: string
}

interface UpsellsCardProps {
  clientId: string
  upsells: Upsell[]
}

// ── Component ──────────────────────────────────────────────────────────────

export function UpsellsCard({ clientId, upsells }: UpsellsCardProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState({
    service: "",
    status: "identified" as UpsellStatus,
    estimatedValue: "",
    notes: "",
  })
  const [errors, setErrors] = useState<{ service?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  function openAdd() {
    setForm({ service: "", status: "identified", estimatedValue: "", notes: "" })
    setErrors({})
    setSheetOpen(true)
  }

  function validate(): boolean {
    const newErrors: { service?: string } = {}
    if (!form.service.trim()) newErrors.service = "Service name is required"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/upsells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: form.service.trim(),
          status: form.status,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to add upsell")
      }

      toast.success("Upsell opportunity added")
      setSheetOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(upsellId: string, status: UpsellStatus) {
    try {
      const res = await fetch(`/api/upsells/${upsellId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success("Status updated")
      router.refresh()
    } catch {
      toast.error("Failed to update status")
    }
  }

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-800">Upsell Opportunities</h2>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">Add Upsell</span>
          </Button>
        </div>

        {upsells.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">
            No upsell opportunities tracked yet.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {upsells.map((upsell) => (
              <div key={upsell.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {upsell.service}
                    </p>
                    {upsell.estimatedValue && (
                      <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                        {formatIDR(upsell.estimatedValue)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={upsell.status}
                      onValueChange={(v) => updateStatus(upsell.id, v as UpsellStatus)}
                    >
                      <SelectTrigger className="h-7 w-auto border-0 shadow-none px-0 gap-1 text-xs font-normal focus:ring-0">
                        <UpsellStatusBadge status={upsell.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="identified">Identified</SelectItem>
                        <SelectItem value="pitched">Pitched</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {upsell.notes && (
                  <p className="text-xs text-neutral-400 mt-1">{upsell.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Upsell Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Add Upsell Opportunity</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-service">
                Service <span className="text-danger-500">*</span>
              </Label>
              <Input
                id="u-service"
                value={form.service}
                onChange={(e) => {
                  setForm((p) => ({ ...p, service: e.target.value }))
                  setErrors((p) => ({ ...p, service: undefined }))
                }}
                placeholder="e.g. Social Media Management"
              />
              {errors.service && (
                <p className="text-xs text-danger-500">{errors.service}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as UpsellStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="pitched">Pitched</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-value">Estimated Value (IDR)</Label>
              <Input
                id="u-value"
                type="number"
                value={form.estimatedValue}
                onChange={(e) => setForm((p) => ({ ...p, estimatedValue: e.target.value }))}
                placeholder="0"
                min={0}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-notes">Notes</Label>
              <Textarea
                id="u-notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Any relevant notes..."
              />
            </div>

            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Upsell"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
