import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/auth-js"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  // OTP flow (invite / recovery) — token_hash takes priority over code
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      const destination =
        type === "recovery"
          ? `/set-password?flow=recovery`
          : type === "invite" && !searchParams.has("next")
            ? `/set-password?flow=invite`
            : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // PKCE flow (OAuth, magic link via code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // If type indicates recovery but arrived via code, still route correctly
      const destination = type === "recovery"
        ? `/set-password?flow=recovery`
        : next
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
