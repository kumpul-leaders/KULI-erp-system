"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
// Note: metadata cannot be exported from a "use client" file.
// Title is set in root layout template. For SEO, wrap in a Server Component if needed.

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")
  const urlError = searchParams.get("error")
  const urlMessage = searchParams.get("message")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const dest = returnTo && /^\/(?!\/)/.test(returnTo) ? returnTo : "/dashboard"
    router.push(dest)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">
            vosFoyer
          </h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-modal">
          <h2 className="mb-6 text-lg font-semibold text-neutral-800">
            Sign in to your account
          </h2>

          {/* URL-driven banners (from redirects) */}
          {urlMessage === "password_updated" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-success-50 border border-success-500/20 px-3 py-2.5 text-sm text-success-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success-500" />
              Password updated. Sign in with your new password.
            </div>
          )}
          {urlError === "auth_callback_failed" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning-50 border border-warning-500/20 px-3 py-2.5 text-sm text-warning-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-warning-500" />
              Your invitation or reset link has expired or is invalid. Ask your admin to resend the invite, or use &lsquo;Forgot password&rsquo; to try again.
            </div>
          )}
          {urlError === "account_disabled" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
              Your account has been disabled. Contact your admin.
            </div>
          )}

          {/* Sign-in error banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Email address
                <span className="ml-0.5 text-danger-500" aria-hidden>*</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vosfoyerid.com"
                disabled={loading}
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                Password
                <span className="ml-0.5 text-danger-500" aria-hidden>*</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end -mt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">
          Internal tool — access by invitation only.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
