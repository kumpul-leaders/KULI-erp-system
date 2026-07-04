"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent("/set-password?flow=recovery")}&type=recovery`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">KULI ERP</h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-8 shadow-modal">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-success-500 mx-auto" />
              <h2 className="text-lg font-semibold text-neutral-800">Email sent</h2>
              <p className="text-sm text-neutral-500">
                Check your inbox at <strong>{email}</strong> and click the reset link.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 text-sm text-accent-600 hover:underline"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-neutral-800">Reset password</h2>
              <p className="mb-6 text-sm text-neutral-500">
                Enter your email and we'll send you a password reset link.
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Email address <span className="text-danger-500" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kumpul-leaders.com"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-neutral-400">
                <Link href="/login" className="hover:text-neutral-600 transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
