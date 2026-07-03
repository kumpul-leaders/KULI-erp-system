"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Pencil } from "lucide-react"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import type { Role } from "@/types"

const ROLE_LABEL: Record<Role, string> = {
  admin: "Super Admin",
  commercial_director: "Commercial Director",
  account_manager: "Account Manager",
  account: "Busdev/AE",
  operation: "Operations",
  hr: "HR",
  finance: "Finance",
}

interface AccountContentProps {
  name: string
  email: string
  role: Role
  division: string | null
  userId: string
}

export function AccountContent({ name, email, role, division, userId }: AccountContentProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const [nameSaving, setNameSaving] = useState(false)

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setPassword("")
      setConfirm("")
      toast.success("Password berhasil diubah.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile card */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-700 mb-4">Profile</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <dt className="text-neutral-500 dark:text-neutral-400">Name</dt>
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="h-7 text-sm w-40"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={nameSaving}
                  onClick={async () => {
                    if (!nameValue.trim()) return
                    setNameSaving(true)
                    try {
                      const res = await fetch(`/api/users/${userId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: nameValue.trim() }),
                      })
                      if (!res.ok) throw new Error("Failed to update name")
                      toast.success("Name updated")
                      setEditingName(false)
                    } catch {
                      toast.error("Failed to update name")
                    } finally {
                      setNameSaving(false)
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setNameValue(name); setEditingName(false) }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <dd className="font-medium text-neutral-800 dark:text-neutral-700">{nameValue}</dd>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Edit name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500 dark:text-neutral-400">Email</dt>
            <dd className="text-neutral-700 dark:text-neutral-300">{email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500 dark:text-neutral-400">Role</dt>
            <dd className="text-neutral-700 dark:text-neutral-300">{ROLE_LABEL[role]}</dd>
          </div>
          {division && (
            <div className="flex justify-between">
              <dt className="text-neutral-500 dark:text-neutral-400">Division</dt>
              <dd className="text-neutral-700 dark:text-neutral-300">{division}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Appearance card */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-700 mb-1">Appearance</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Toggle between light and dark mode.</p>
        <ThemeToggle variant="full" />
      </div>

      {/* Change password card */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-700 mb-1">Change Password</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Set a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-neutral-700 dark:text-neutral-700">
              New Password <span className="text-danger-500" aria-hidden>*</span>
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-neutral-700 dark:text-neutral-700">
              Confirm Password <span className="text-danger-500" aria-hidden>*</span>
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <Button type="submit" size="sm" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
