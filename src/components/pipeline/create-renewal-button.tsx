"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LeadFormSheet } from "@/components/pipeline/lead-form-sheet"
import type { LeadFormInitialValues } from "@/components/pipeline/lead-form-sheet"

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateRenewalButtonProps {
  clientId: string
  clientName: string
  salesOptions: Array<{ id: string; name: string }>
  /** Optional: lead ID to use as renewedFromLeadId. If not provided, component will fetch the latest won lead. */
  renewedFromLeadId?: string
  className?: string
}

// ── API response type ─────────────────────────────────────────────────────────

interface LeadApiResponse {
  leads?: Array<{
    id: string
    productLine: string | null
    projectedRevenue: number | null
    stage: string
  }>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateRenewalButton({
  clientId,
  clientName,
  salesOptions,
  renewedFromLeadId: propRenewedFromLeadId,
  className,
}: CreateRenewalButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialValues, setInitialValues] = useState<LeadFormInitialValues | null>(null)

  async function handleClick() {
    if (initialValues) {
      // Already fetched — just open
      setOpen(true)
      return
    }

    setLoading(true)
    try {
      let renewedFromLeadId = propRenewedFromLeadId
      let productLine: string | undefined
      let projectedRevenue: string | undefined

      if (!renewedFromLeadId) {
        // Fetch latest won lead for this client
        const wonStages = ["closed_won", "invoiced", "contract_renewal"].join(",")
        const res = await fetch(
          `/api/leads?clientId=${clientId}&stage=${wonStages}&limit=1`
        )
        if (res.ok) {
          const data = (await res.json()) as LeadApiResponse
          const wonLead = data.leads?.[0]
          if (wonLead) {
            renewedFromLeadId = wonLead.id
            productLine = wonLead.productLine ?? undefined
            projectedRevenue = wonLead.projectedRevenue
              ? String(wonLead.projectedRevenue)
              : undefined
          }
        }
      }

      setInitialValues({
        clientId,
        clientName,
        productLine,
        projectedRevenue,
        stage: "contract_renewal",
        renewedFromLeadId,
      })
      setOpen(true)
    } catch {
      toast.error("Gagal memuat data lead")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={className}
        disabled={loading}
        onClick={() => void handleClick()}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        {loading ? "Memuat..." : "Buat Renewal Lead"}
      </Button>

      {initialValues && (
        <LeadFormSheet
          open={open}
          onOpenChange={setOpen}
          salesOptions={salesOptions}
          initialValues={initialValues}
        />
      )}
    </>
  )
}
