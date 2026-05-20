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
import { Input } from "@/components/ui/input"
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
  const [confirmInput, setConfirmInput] = useState("")

  function openDeleteDialog() {
    setConfirmInput("")
    setDeleteOpen(true)
  }

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
          onClick={openDeleteDialog}
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
        onDelete={isAdmin ? openDeleteDialog : undefined}
      />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Client?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tindakan ini tidak bisa dibatalkan. Data client{" "}
                  <span className="font-medium text-neutral-900">{client.name}</span>{" "}
                  akan dihapus permanen.
                </p>
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500">
                    Ketik{" "}
                    <code className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-xs border border-neutral-200">
                      {client.name}
                    </code>{" "}
                    untuk konfirmasi:
                  </p>
                  <Input
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={client.name}
                    disabled={deleting}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || confirmInput !== client.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
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
