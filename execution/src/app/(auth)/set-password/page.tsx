import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SetPasswordForm } from "./set-password-form"
import { AlertCircle } from "lucide-react"

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">vosFoyer</h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-modal">
          {!user ? (
            <div className="text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-warning-500 mx-auto" />
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
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-neutral-800">Set your password</h2>
              <p className="mb-6 text-sm text-neutral-500">
                Choose a password to secure your account.
              </p>
              <SetPasswordForm />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
