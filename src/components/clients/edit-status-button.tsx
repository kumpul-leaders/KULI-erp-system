"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { HealthStatus, ClientStatus } from "@/types"

interface EditStatusButtonProps {
  clientId: string
  currentHealthStatus: HealthStatus | null
  currentClientStatus: ClientStatus
}

export function EditStatusButton({
  clientId,
  currentHealthStatus,
  currentClientStatus,
}: EditStatusButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | "">(currentHealthStatus ?? "")
  const [clientStatus, setClientStatus] = useState<ClientStatus>(currentClientStatus)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          healthStatus: healthStatus || null,
          clientStatus,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update status")
      }
      toast.success("Status updated")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit Status
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[360px] sm:max-w-[360px]">
          <SheetHeader className="mb-6">
            <SheetTitle>Edit Status</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Health Status</Label>
              <Select
                value={healthStatus || "none"}
                onValueChange={(v) => setHealthStatus(v === "none" ? "" : v as HealthStatus)}
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

            <div className="space-y-1.5">
              <Label>Client Status</Label>
              <Select
                value={clientStatus}
                onValueChange={(v) => setClientStatus(v as ClientStatus)}
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

            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
