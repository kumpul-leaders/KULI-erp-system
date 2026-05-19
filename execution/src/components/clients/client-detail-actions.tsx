"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditClientSheet } from "@/components/clients/edit-client-sheet"
import type { EngagementType, HealthStatus, ClientStatus } from "@/types"

interface AeOption {
  id: string
  name: string
}

interface ClientForEdit {
  id: string
  name: string
  customerCode?: string | null
  industry?: string | null
  orgSize?: string | null
  engagementType: EngagementType
  contractStart?: string | null
  contractEnd?: string | null
  monthlyValue?: number | null
  annualValue?: number | null
  healthStatus: HealthStatus
  clientStatus?: ClientStatus | null
  primaryAe?: string | null
  notes?: string | null
}

interface ClientDetailActionsProps {
  client: ClientForEdit
  aeOptions: AeOption[]
}

export function ClientDetailActions({ client, aeOptions }: ClientDetailActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>

      <EditClientSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        aeOptions={aeOptions}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
