"use client"

import { useState } from "react"
import { Pencil, UserPlus } from "lucide-react"
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
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: Role[] = ["admin", "account", "operation", "hr", "finance"]

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
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

// ── Component ────────────────────────────────────────────────────────────────

export function SettingsContent({ users: initialUsers, isAdmin }: SettingsContentProps) {
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
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────────────

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

  async function handleDeactivate(userId: string) {
    setToggleError(null)
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive: false } : u))
        )
      } else {
        const data = (await res.json()) as { error?: string }
        setToggleError(data.error ?? "Failed to deactivate user.")
      }
    } catch {
      setToggleError("Network error. Could not deactivate user.")
    }
  }

  async function handleActivate(userId: string) {
    setToggleError(null)
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
      } else {
        const data = (await res.json()) as { error?: string }
        setToggleError(data.error ?? "Failed to activate user.")
      }
    } catch {
      setToggleError("Network error. Could not activate user.")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      {/* ── Card 1: Team Members ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        {toggleError && (
          <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{toggleError}</p>
        )}
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
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        ROLE_BADGE[user.role] ?? "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {user.role}
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-800"
                          onClick={() => openEditSheet(user)}
                          title="Edit user"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {user.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                            onClick={() => handleDeactivate(user.id)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-success-50"
                            onClick={() => handleActivate(user.id)}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Card 2: Pipeline Reference ───────────────────────────────────── */}
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
              {STAGE_GATES.map((row) => (
                <tr key={row.from} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-700">{row.from}</td>
                  <td className="px-4 py-3 text-neutral-600">{row.gate}</td>
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
                  <td className="px-4 py-3 text-neutral-700">{row.display}</td>
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
              <SelectItem key={r} value={r} className="capitalize">
                {r}
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
