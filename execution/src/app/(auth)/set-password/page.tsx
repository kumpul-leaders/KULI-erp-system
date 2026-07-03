import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SetPasswordForm } from "./set-password-form"
import { AlertCircle } from "lucide-react"

interface SetPasswordPageProps {
  searchParams: Promise<{ flow?: string }>
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const { flow: rawFlow } = await searchParams
  const flow: "invite" | "recovery" = rawFlow === "recovery" ? "recovery" : "invite"

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">Open ERP</h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-8 shadow-modal">
          {!user ? (
            <div className="text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-warning-500 mx-auto" />
              {flow === "recovery" ? (
                <>
                  <h2 className="text-lg font-semibold text-neutral-800">Reset link expired</h2>
                  <p className="text-sm text-neutral-500">
                    This password reset link is no longer valid. Request a new one below.
                  </p>
                  <Link
                    href="/forgot-password"
                    className="inline-block text-sm text-accent-600 hover:underline"
                  >
                    Request new reset link
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-neutral-800">Link has expired</h2>
                  <p className="text-sm text-neutral-500">
                    This invitation link is no longer valid. Ask your admin to resend the invite from the Settings page.
                  </p>
                  <Link
                    href="/login"
                    className="inline-block text-sm text-accent-600 hover:underline"
                  >
                    Back to login
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-neutral-800">
                {flow === "recovery" ? "Reset your password" : "Set your password"}
              </h2>
              <p className="mb-6 text-sm text-neutral-500">
                {flow === "recovery"
                  ? "Enter a new password for your account."
                  : "Choose a password to secure your account."}
              </p>
              <SetPasswordForm flow={flow} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
