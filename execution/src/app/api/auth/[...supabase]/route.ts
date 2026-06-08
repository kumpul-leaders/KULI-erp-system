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

  console.log("[auth-callback] params", {
    hasTokenHash: !!token_hash,
    type,
    hasCode: !!code,
    next,
    allKeys: Array.from(searchParams.keys()),
    fullUrl: request.url,
  })

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

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      const destination =
        type === "recovery"
          ? `/set-password?flow=recovery`
          : type === "invite" && !searchParams.has("next")
            ? `/set-password?flow=invite`
            : next
      console.log("[auth-callback] otp success", { type, destination })
      return NextResponse.redirect(`${origin}${destination}`)
    }
    console.error("[auth-callback] verifyOtp failed", { type, message: error.message, status: error.status })
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const destination = type === "recovery"
        ? `/set-password?flow=recovery`
        : next
      console.log("[auth-callback] pkce success", { destination })
      return NextResponse.redirect(`${origin}${destination}`)
    }
    console.error("[auth-callback] exchangeCodeForSession failed", { message: error.message, status: error.status })
  }

  console.error("[auth-callback] fall-through to error redirect", {
    hadTokenHash: !!token_hash,
    hadCode: !!code,
    type,
  })
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
