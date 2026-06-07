import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required to keep auth state alive.
  // Do not run server-side logic between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ── Unauthenticated → redirect to /login ──────────────────
  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/pipeline") ||
    pathname.startsWith("/targets") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/account")

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.searchParams.set("returnTo", pathname)
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // ── Authenticated user visiting /login or /forgot-password → redirect to /dashboard ──
  if (user && (pathname === "/login" || pathname === "/forgot-password")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // ── Authenticated user visiting /set-password → redirect to /account ──
  // Exception: allow if request came directly from /api/auth/callback (invited user
  // who has just been authenticated via the callback and is being forwarded to set
  // their password for the first time).
  if (user && pathname === "/set-password") {
    if (!request.nextUrl.searchParams.has("flow")) {
      const url = request.nextUrl.clone()
      url.pathname = "/account"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
