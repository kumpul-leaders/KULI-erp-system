"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, Mail, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Role } from "@/types"

// ── Types ────────────────────────────────────────────────────────────────────

export type SerializedUser = {
  id: string
  name: string
  email: string
  role: Role
  division: string | null
  isActive: boolean
  isVp: boolean
  createdAt: string
  updatedAt: string
}

interface SettingsContentProps {
  users: SerializedUser[]
  isAdmin: boolean
  leadCountMap: Record<string, number>
  clientCountMap: Record<string, number>
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: Role[] = ["admin", "commercial_director", "account_manager", "account", "operation", "hr", "finance"]

const ROLE_LABEL: Record<string, string> = {
  admin: "Super Admin",
  commercial_director: "Commercial Director",
  account_manager: "Account Manager",
  account: "Busdev/AE",
  operation: "Operations",
  hr: "HR",
  finance: "Finance",
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  commercial_director: "bg-indigo-100 text-indigo-700",
  account_manager: "bg-violet-100 text-violet-700",
  account: "bg-blue-100 text-blue-700",
  operation: "bg-green-100 text-green-700",
  hr: "bg-orange-100 text-orange-700",
  finance: "bg-yellow-100 text-yellow-700",
}

const PRODUCT_LINES: Array<{ db: string; display: string }> = [
  { db: "smm", display: "Social Media Management" },
  { db: "stracomm", display: "Stracomm" },
  { db: "creative_strategy", display: "Creative Strategy" },
  { db: "media_buying", display: "Media Buying" },
  { db: "ads_management", display: "Ads Management" },
  { db: "production", display: "Production" },
  { db: "others", display: "Others" },
]

const STAGE_GATES: Array<{ from: string; gate: string }> = [
  { from: "Leads → Pipeline", gate: "Quotation document" },
  { from: "Pipeline → Negotiation", gate: "None" },
  { from: "Negotiation → Closed Won", gate: "Signed Quotation" },
  { from: "Closed Won → Invoiced", gate: "None" },
  { from: "Invoiced → Contract Renewal", gate: "None" },
  { from: "Any → Lost Deal", gate: "None" },
  { from: "Any → No Response", gate: "None" },
]

// ── Empty form state ─────────────────────────────────────────────────────────

type UserForm = {
  name: string
  email: string
  role: Role
  division: string
  isVp: boolean
}

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  role: "account",
  division: "",
  isVp: false,
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Deactivate dialog state ──────────────────────────────────────────────────

type DeactivateDialogState =
  | { open: false }
  | { open: true; userId: string; userName: string; leads: number; clients: number }

// ── Component ────────────────────────────────────────────────────────────────

export function SettingsContent({
  users: initialUsers,
  isAdmin,
  leadCountMap,
  clientCountMap,
}: SettingsContentProps) {
  const router = useRouter()
  const [users, setUsers] = useState<SerializedUser[]>(initialUsers)

  // Sheet state
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SerializedUser | null>(null)

  // Form state
  const [addForm, setAddForm] = useState<UserForm>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Smart Deactivate Dialog state
  const [deactivateDialog, setDeactivateDialog] = useState<DeactivateDialogState>({ open: false })
  const [deactivateReplacementId, setDeactivateReplacementId] = useState<string>("")
  const [isDeactivating, setIsDeactivating] = useState(false)

  // Activate/Deactivate loading state
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  // Auth email (invite / reset) loading state
  const [loadingAuthUserId, setLoadingAuthUserId] = useState<string | null>(null)

  // ── System Config: stage gates + product line labels ─────────────────────

  type StageGateRow = { from: string; gate: string }
  type ProductLineLabelMap = Record<string, string>

  const [stageGates, setStageGates] = useState<StageGateRow[]>(STAGE_GATES)
  const [productLineLabels, setProductLineLabels] = useState<ProductLineLabelMap>(
    Object.fromEntries(PRODUCT_LINES.map((p) => [p.db, p.display]))
  )

  const [editingGateIdx, setEditingGateIdx] = useState<number | null>(null)
  const [editingGateValue, setEditingGateValue] = useState("")
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState("")
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    fetch("/api/system-config")
      .then((r) => r.json())
      .then((data: { config: Record<string, unknown> }) => {
        if (Array.isArray(data.config?.stage_gates)) {
          setStageGates(data.config.stage_gates as StageGateRow[])
        }
        if (
          data.config?.product_line_labels &&
          typeof data.config.product_line_labels === "object" &&
          !Array.isArray(data.config.product_line_labels)
        ) {
          setProductLineLabels(data.config.product_line_labels as ProductLineLabelMap)
        }
      })
      .catch(() => {}) // fallback to hardcoded on error
  }, [])

  // Delete dialog state
  type DeleteDialogState = { open: false } | { open: true; userId: string; userName: string }
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false })
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Bulk Reassign section state
  const [bulkFromId, setBulkFromId] = useState<string>("")
  const [bulkToId, setBulkToId] = useState<string>("")
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [isBulkReassigning, setIsBulkReassigning] = useState(false)

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Active users excluding a specific userId (for "To" dropdowns)
  function activeUsersExcluding(excludeId: string) {
    return users.filter((u) => u.isActive && u.id !== excludeId)
  }

  // ── Handlers: User CRUD ──────────────────────────────────────────────────

  function openEditSheet(user: SerializedUser) {
    setEditingUser(user)
    setEditForm({
      name: user.name,
      email: user.email,
      role: ROLE_OPTIONS.includes(user.role) ? user.role : "account",
      division: user.division ?? "",
      isVp: user.isVp,
    })
    setEditError(null)
    setIsEditSheetOpen(true)
  }

  function validateForm(form: UserForm): string | null {
    if (!form.name.trim()) return "Name is required."
    if (!form.email.trim() || !EMAIL_REGEX.test(form.email)) return "Valid email is required."
    if (!ROLE_OPTIONS.includes(form.role)) return "Valid role is required."
    return null
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validateForm(addForm)
    if (validationError) {
      setAddError(validationError)
      return
    }
    setAddError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          role: addForm.role,
          division: addForm.division.trim() || undefined,
          isVp: addForm.isVp,
        }),
      })

      const data = (await res.json()) as { user?: SerializedUser; error?: string }

      if (!res.ok) {
        setAddError(data.error ?? "Something went wrong.")
        return
      }

      if (data.user) {
        setUsers((prev) =>
          [...prev, data.user!].sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setAddForm(EMPTY_FORM)
      setIsAddSheetOpen(false)
    } catch {
      setAddError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    const validationError = validateForm(editForm)
    if (validationError) {
      setEditError(validationError)
      return
    }
    setEditError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
          division: editForm.division.trim() || null,
          isVp: editForm.isVp,
        }),
      })

      const data = (await res.json()) as { user?: SerializedUser; error?: string }

      if (!res.ok) {
        setEditError(data.error ?? "Something went wrong.")
        return
      }

      if (data.user) {
        setUsers((prev) =>
          prev
            .map((u) => (u.id === editingUser.id ? data.user! : u))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setIsEditSheetOpen(false)
      setEditingUser(null)
    } catch {
      setEditError("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Handlers: Smart Deactivate ───────────────────────────────────────────

  function openDeactivateDialog(user: SerializedUser) {
    const leads = leadCountMap[user.id] ?? 0
    const clients = clientCountMap[user.id] ?? 0

    if (leads === 0 && clients === 0) {
      // No owned records — deactivate immediately with simple confirm dialog
      setDeactivateDialog({ open: true, userId: user.id, userName: user.name, leads: 0, clients: 0 })
      setDeactivateReplacementId("")
    } else {
      // Has owned records — open smart dialog with reassign option
      setDeactivateDialog({ open: true, userId: user.id, userName: user.name, leads, clients })
      setDeactivateReplacementId("")
    }
  }

  async function executeDeactivate(userId: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? "Failed to deactivate user.")
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: false } : u))
    )
  }

  async function handleDeactivateWithReassign() {
    if (!deactivateDialog.open) return
    const { userId, userName, leads, clients } = deactivateDialog

    if (!deactivateReplacementId) {
      toast.error("Pilih pengganti terlebih dahulu.")
      return
    }

    setIsDeactivating(true)
    try {
      // Step 1: bulk reassign
      const reassignRes = await fetch("/api/leads/bulk-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: userId, toUserId: deactivateReplacementId }),
      })
      if (!reassignRes.ok) {
        const data = (await reassignRes.json()) as { error?: string }
        toast.error(data.error ?? "Gagal memindah leads/clients.")
        return
      }

      // Step 2: deactivate
      await executeDeactivate(userId)

      const replacementName = users.find((u) => u.id === deactivateReplacementId)?.name ?? "pengganti"
      const parts: string[] = []
      if (leads > 0) parts.push(`${leads} lead${leads > 1 ? "s" : ""}`)
      if (clients > 0) parts.push(`${clients} client${clients > 1 ? "s" : ""}`)
      toast.success(
        `${parts.join(" dan ")} dipindah ke ${replacementName}. ${userName} dinonaktifkan.`
      )

      setDeactivateDialog({ open: false })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan.")
    } finally {
      setIsDeactivating(false)
    }
  }

  async function handleDeactivateWithoutReassign() {
    if (!deactivateDialog.open) return
    const { userId, userName } = deactivateDialog

    setIsDeactivating(true)
    try {
      await executeDeactivate(userId)
      toast.success(`${userName} dinonaktifkan.`)
      setDeactivateDialog({ open: false })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan.")
    } finally {
      setIsDeactivating(false)
    }
  }

  async function handleDelete() {
    if (!deleteDialog.open) return
    const { userId, userName } = deleteDialog

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? "Gagal menghapus user.")
        return
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId))
      toast.success(`${userName} dihapus permanen.`)
      setDeleteDialog({ open: false })
    } catch {
      toast.error("Network error. Coba lagi.")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleAuthAction(userId: string, _userEmail: string, type: "invite" | "reset") {
    setLoadingAuthUserId(userId)
    try {
      const res = await fetch(`/api/users/${userId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed")
      toast.success(
        type === "invite" ? "Invite email terkirim" : "Password reset email terkirim"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoadingAuthUserId(null)
    }
  }

  async function handleActivate(userId: string) {
    setLoadingUserId(userId)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive: true } : u))
        )
        toast.success("User diaktifkan.")
      } else {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error ?? "Failed to activate user.")
      }
    } catch {
      toast.error("Network error. Could not activate user.")
    } finally {
      setLoadingUserId(null)
    }
  }

  // ── Handlers: Bulk Reassign ──────────────────────────────────────────────

  async function handleBulkReassign() {
    if (!bulkFromId || !bulkToId) return
    setIsBulkReassigning(true)
    try {
      const res = await fetch("/api/leads/bulk-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: bulkFromId, toUserId: bulkToId }),
      })
      const data = (await res.json()) as {
        leadsReassigned?: number
        clientsReassigned?: number
        error?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memindah leads/clients.")
        return
      }

      const fromName = users.find((u) => u.id === bulkFromId)?.name ?? "sumber"
      const toName = users.find((u) => u.id === bulkToId)?.name ?? "tujuan"
      const parts: string[] = []
      if ((data.leadsReassigned ?? 0) > 0) parts.push(`${data.leadsReassigned} leads`)
      if ((data.clientsReassigned ?? 0) > 0) parts.push(`${data.clientsReassigned} clients`)

      if (parts.length === 0) {
        toast.success(`Tidak ada leads/clients milik ${fromName} yang perlu dipindah.`)
      } else {
        toast.success(`${parts.join(" dan ")} dipindah dari ${fromName} ke ${toName}.`)
      }

      setBulkFromId("")
      setBulkToId("")
      setBulkConfirmOpen(false)
      router.refresh()
    } catch {
      toast.error("Network error. Coba lagi.")
    } finally {
      setIsBulkReassigning(false)
    }
  }

  // ── Handlers: System Config ──────────────────────────────────────────────

  async function handleSaveGate(idx: number) {
    setSavingConfig(true)
    const updated = stageGates.map((row, i) =>
      i === idx ? { ...row, gate: editingGateValue } : row
    )
    try {
      const res = await fetch("/api/system-config/stage_gates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: updated }),
      })
      if (!res.ok) throw new Error("Failed")
      setStageGates(updated)
      setEditingGateIdx(null)
      toast.success("Stage gate updated")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleSaveLabel(key: string) {
    setSavingConfig(true)
    const updated = { ...productLineLabels, [key]: editingLabelValue }
    try {
      const res = await fetch("/api/system-config/product_line_labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: updated }),
      })
      if (!res.ok) throw new Error("Failed")
      setProductLineLabels(updated)
      setEditingLabelKey(null)
      toast.success("Label updated")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSavingConfig(false)
    }
  }

  // ── Derived values for Bulk Reassign preview ─────────────────────────────

  const bulkLeadCount = bulkFromId ? (leadCountMap[bulkFromId] ?? 0) : 0
  const bulkClientCount = bulkFromId ? (clientCountMap[bulkFromId] ?? 0) : 0
  const bulkFromName = users.find((u) => u.id === bulkFromId)?.name ?? ""
  const bulkToName = users.find((u) => u.id === bulkToId)?.name ?? ""

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Card 1: Team Members ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-800">Team Members</h3>
          {isAdmin && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setAddForm(EMPTY_FORM)
                setAddError(null)
                setIsAddSheetOpen(true)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          )}
        </div>

        <div className="rounded-md border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/4">Name</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/3">Email</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/6">Role</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500 w-1/8">Status</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 font-medium text-neutral-500 w-1/6">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-neutral-800">
                    {user.name}
                    {user.isVp && (
                      <span className="ml-1.5 text-xs text-neutral-400 font-normal">(VP)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ROLE_BADGE[user.role] ?? "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          user.isActive ? "bg-emerald-500" : "bg-neutral-400"
                        }`}
                      />
                      <span
                        className={user.isActive ? "text-emerald-700" : "text-neutral-400"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-neutral-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openEditSheet(user)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.isActive ? (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  void handleAuthAction(user.id, user.email, "invite")
                                }
                                disabled={loadingAuthUserId === user.id}
                              >
                                <Mail className="h-3.5 w-3.5 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  void handleAuthAction(user.id, user.email, "reset")
                                }
                                disabled={loadingAuthUserId === user.id}
                              >
                                <KeyRound className="h-3.5 w-3.5 mr-2" />
                                Send Password Reset
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-danger-600 focus:text-danger-700"
                                onClick={() => openDeactivateDialog(user)}
                              >
                                Deactivate
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem
                                className="text-emerald-600 focus:text-emerald-700"
                                onClick={() => void handleActivate(user.id)}
                                disabled={loadingUserId === user.id}
                              >
                                {loadingUserId === user.id ? "Loading..." : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-danger-600 focus:text-danger-700"
                                onClick={() => {
                                  setDeleteConfirmInput("")
                                  setDeleteDialog({ open: true, userId: user.id, userName: user.name })
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Card 2: Bulk Reassign Leads ──────────────────────────────────── */}
      {isAdmin && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-neutral-800 mb-1">Reassign Leads</h3>
          <p className="text-xs text-neutral-500 mb-5">
            Pindahkan semua leads dan clients dari satu Busdev/AE ke Busdev/AE lain.
            Berguna untuk AE yang resign atau tidak aktif.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* From — all users including inactive */}
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500">Dari</Label>
              <Select
                value={bulkFromId}
                onValueChange={(v) => {
                  setBulkFromId(v)
                  // Reset To if it matches the new From
                  if (bulkToId === v) setBulkToId("")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih sumber..." />
                </SelectTrigger>
                <SelectContent>
                  {[...users]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {!u.isActive && (
                          <span className="ml-1.5 text-neutral-400">(Nonaktif)</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* To — active users only, excluding fromId */}
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-500">Ke</Label>
              <Select
                value={bulkToId}
                onValueChange={setBulkToId}
                disabled={!bulkFromId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {activeUsersExcluding(bulkFromId).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reactive preview */}
          {bulkFromId && bulkToId && (
            <p className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded px-3 py-2 mb-4">
              <span className="font-medium">{bulkLeadCount} lead{bulkLeadCount !== 1 ? "s" : ""}</span>
              {" "}dan{" "}
              <span className="font-medium">{bulkClientCount} client{bulkClientCount !== 1 ? "s" : ""}</span>
              {" "}akan dipindah dari{" "}
              <span className="font-medium">{bulkFromName}</span>
              {" "}ke{" "}
              <span className="font-medium">{bulkToName}</span>.
            </p>
          )}

          <Button
            size="sm"
            disabled={!bulkFromId || !bulkToId || isBulkReassigning}
            onClick={() => setBulkConfirmOpen(true)}
          >
            Reassign Semua
          </Button>
        </div>
      )}

      {/* ── Card 3: Pipeline Reference ───────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 mb-4">Pipeline Reference</h3>

        {/* Stage Gate Requirements */}
        <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">
          Stage Gate Requirements
        </p>
        <div className="rounded-md border border-neutral-200 overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">Gate Required</th>
              </tr>
            </thead>
            <tbody>
              {stageGates.map((row, idx) => (
                <tr key={row.from} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-700">{row.from}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {isAdmin && editingGateIdx === idx ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingGateValue}
                          onChange={(e) => setEditingGateValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveGate(idx)
                            if (e.key === "Escape") setEditingGateIdx(null)
                          }}
                          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => void handleSaveGate(idx)}
                          disabled={savingConfig}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingGateIdx(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span>{row.gate}</span>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditingGateIdx(idx)
                              setEditingGateValue(row.gate)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Product Lines */}
        <p className="text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wide">
          Product Lines
        </p>
        <div className="rounded-md border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">DB Value</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-500">Display Name</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_LINES.map((row) => (
                <tr key={row.db} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.db}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {isAdmin && editingLabelKey === row.db ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingLabelValue}
                          onChange={(e) => setEditingLabelValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveLabel(row.db)
                            if (e.key === "Escape") setEditingLabelKey(null)
                          }}
                          className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => void handleSaveLabel(row.db)}
                          disabled={savingConfig}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingLabelKey(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span>{productLineLabels[row.db] ?? row.display}</span>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditingLabelKey(row.db)
                              setEditingLabelValue(productLineLabels[row.db] ?? row.display)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 transition-opacity"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add User Sheet ───────────────────────────────────────────────── */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add User</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAddSubmit} className="mt-6 space-y-4">
            <UserFormFields
              form={addForm}
              onChange={setAddForm}
              error={addError}
              isSubmitting={isSubmitting}
              submitLabel="Add User"
            />
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Edit User Sheet ──────────────────────────────────────────────── */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit User</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
            <UserFormFields
              form={editForm}
              onChange={setEditForm}
              error={editError}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
            />
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Smart Deactivate Dialog ──────────────────────────────────────── */}
      <AlertDialog open={deactivateDialog.open} onOpenChange={(open) => {
        if (!open) setDeactivateDialog({ open: false })
      }}>
        <AlertDialogContent>
          {deactivateDialog.open && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {deactivateDialog.leads > 0 || deactivateDialog.clients > 0
                    ? "Reassign sebelum nonaktifkan?"
                    : `Nonaktifkan ${deactivateDialog.userName}?`}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    {deactivateDialog.leads > 0 || deactivateDialog.clients > 0 ? (
                      <>
                        <p>
                          <span className="font-medium text-neutral-800">
                            {deactivateDialog.userName}
                          </span>{" "}
                          masih punya{" "}
                          {deactivateDialog.leads > 0 && (
                            <span className="font-semibold text-neutral-800">
                              {deactivateDialog.leads} lead{deactivateDialog.leads > 1 ? "s" : ""}
                            </span>
                          )}
                          {deactivateDialog.leads > 0 && deactivateDialog.clients > 0 && " dan "}
                          {deactivateDialog.clients > 0 && (
                            <span className="font-semibold text-neutral-800">
                              {deactivateDialog.clients} client{deactivateDialog.clients > 1 ? "s" : ""}
                            </span>
                          )}
                          . Pilih Busdev/AE pengganti, atau nonaktifkan tanpa reassign.
                        </p>

                        <div className="space-y-1.5">
                          <Label className="text-xs text-neutral-600">Reassign ke:</Label>
                          <Select
                            value={deactivateReplacementId}
                            onValueChange={setDeactivateReplacementId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih pengganti..." />
                            </SelectTrigger>
                            <SelectContent>
                              {activeUsersExcluding(deactivateDialog.userId).map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : (
                      <p>
                        Yakin nonaktifkan{" "}
                        <span className="font-medium text-neutral-800">
                          {deactivateDialog.userName}
                        </span>
                        ? User tidak akan bisa login.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                {/* Cancel */}
                <AlertDialogCancel
                  disabled={isDeactivating}
                  className="sm:mr-auto"
                >
                  Batal
                </AlertDialogCancel>

                {/* Nonaktifkan Tanpa Reassign (always shown) */}
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); void handleDeactivateWithoutReassign() }}
                  disabled={isDeactivating}
                  className="bg-transparent border border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-none"
                >
                  {deactivateDialog.leads > 0 || deactivateDialog.clients > 0
                    ? "Nonaktifkan Tanpa Reassign"
                    : "Nonaktifkan"}
                </AlertDialogAction>

                {/* Nonaktifkan & Reassign (only when user has leads/clients) */}
                {(deactivateDialog.leads > 0 || deactivateDialog.clients > 0) && (
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); void handleDeactivateWithReassign() }}
                    disabled={isDeactivating || !deactivateReplacementId}
                  >
                    {isDeactivating ? "Memproses..." : "Nonaktifkan & Reassign"}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete User Dialog ───────────────────────────────────────────── */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => {
        if (!open && !isDeleting) setDeleteDialog({ open: false })
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User Permanen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tindakan ini tidak bisa dibatalkan. User{" "}
                  <span className="font-medium text-neutral-900">
                    {deleteDialog.open ? deleteDialog.userName : ""}
                  </span>{" "}
                  akan dihapus permanen dari sistem dan tidak bisa login.
                </p>
                <div className="space-y-1.5">
                  <p className="text-xs text-neutral-500">
                    Ketik{" "}
                    <code className="px-1 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-xs border border-neutral-200">
                      {deleteDialog.open ? deleteDialog.userName : ""}
                    </code>{" "}
                    untuk konfirmasi:
                  </p>
                  <Input
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={deleteDialog.open ? deleteDialog.userName : ""}
                    disabled={isDeleting}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete() }}
              disabled={isDeleting || !deleteDialog.open || deleteConfirmInput !== deleteDialog.userName}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
            >
              {isDeleting ? (
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

      {/* ── Bulk Reassign Confirm Dialog ─────────────────────────────────── */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Reassign</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkLeadCount + bulkClientCount === 0
                ? `Tidak ada leads atau clients milik ${bulkFromName}. Lanjutkan?`
                : `Pindahkan ${bulkLeadCount} lead${bulkLeadCount !== 1 ? "s" : ""} dan ${bulkClientCount} client${bulkClientCount !== 1 ? "s" : ""} dari ${bulkFromName} ke ${bulkToName}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={isBulkReassigning}
              onClick={() => setBulkConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={isBulkReassigning}
              onClick={() => void handleBulkReassign()}
            >
              {isBulkReassigning ? "Memproses..." : "Ya, Reassign"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── UserFormFields sub-component ─────────────────────────────────────────────

interface UserFormFieldsProps {
  form: UserForm
  onChange: (form: UserForm) => void
  error: string | null
  isSubmitting: boolean
  submitLabel: string
}

function UserFormFields({
  form,
  onChange,
  error,
  isSubmitting,
  submitLabel,
}: UserFormFieldsProps) {
  return (
    <>
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="uf-name">
          Name <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="uf-name"
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Andi Wijaya"
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="uf-email">
          Email <span className="text-danger-500">*</span>
        </Label>
        <Input
          id="uf-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="e.g. andi@vosFoyer.com"
        />
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <Label>
          Role <span className="text-danger-500">*</span>
        </Label>
        <Select
          value={form.role}
          onValueChange={(v) => onChange({ ...form, role: v as Role })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Division */}
      <div className="space-y-1.5">
        <Label htmlFor="uf-division">Division (optional)</Label>
        <Input
          id="uf-division"
          type="text"
          value={form.division}
          onChange={(e) => onChange({ ...form, division: e.target.value })}
          placeholder="e.g. Creative"
        />
      </div>

      {/* VP toggle */}
      <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-3">
        <Label htmlFor="uf-vp" className="cursor-pointer">
          Is VP?
        </Label>
        <Switch
          id="uf-vp"
          checked={form.isVp}
          onCheckedChange={(checked) => onChange({ ...form, isVp: checked })}
        />
      </div>

      {/* Inline error */}
      {error && (
        <p className="text-xs text-danger-600 bg-danger-50 rounded-md px-3 py-2">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </>
  )
}
