"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
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
}

export function AccountContent({ name, email, role, division }: AccountContentProps) {
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
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setPassword("")
    setConfirm("")
    toast.success("Password berhasil diubah.")
    setLoading(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 mb-4">Profile</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Name</dt>
            <dd className="font-medium text-neutral-800">{name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Email</dt>
            <dd className="text-neutral-700">{email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Role</dt>
            <dd className="text-neutral-700">{ROLE_LABEL[role]}</dd>
          </div>
          {division && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Division</dt>
              <dd className="text-neutral-700">{division}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Change password card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 mb-1">Change Password</h3>
        <p className="text-xs text-neutral-500 mb-4">Set a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-neutral-700">
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
            <Label htmlFor="confirm-password" className="text-sm font-medium text-neutral-700">
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
