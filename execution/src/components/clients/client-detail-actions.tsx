"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
  isAdmin: boolean
}

export function ClientDetailActions({ client, aeOptions, isAdmin }: ClientDetailActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Gagal menghapus client")
      toast.success("Client berhasil dihapus")
      router.push("/clients")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      {isAdmin && (
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      )}

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
        onDelete={isAdmin ? () => setDeleteOpen(true) : undefined}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Client?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Data client{" "}
              <span className="font-medium text-neutral-900">{client.name}</span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Menghapus...
                </>
              ) : (
                "Hapus"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
