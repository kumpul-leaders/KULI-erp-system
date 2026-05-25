import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"

// ── Type guard ───────────────────────────────────────────────────────────────

type InviteType = "invite" | "reset"

function isInviteType(v: unknown): v is InviteType {
  return v === "invite" || v === "reset"
}

// ── POST /api/users/[id]/invite ──────────────────────────────────────────────
// Admin/Director only. Sends a Supabase invite or password reset email.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminOrDirector()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isInviteType(body.type)) {
    return NextResponse.json(
      { error: 'type must be "invite" or "reset"' },
      { status: 400 }
    )
  }

  const type = body.type

  // Fetch user from DB
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isActive: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: "Can only send auth emails to active users." },
      { status: 400 }
    )
  }

  // Require service role key
  const adminClient = createAdminClient()
  if (!adminClient) {
    return NextResponse.json(
      { error: "Service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    )
  }

  const redirectTo = `${
    process.env.NEXT_PUBLIC_APP_URL ?? "https://vf-erp.vercel.app"
  }/api/auth/callback?next=/dashboard`

  try {
    if (type === "invite") {
      const { error } = await adminClient.auth.admin.inviteUserByEmail(user.email, {
        redirectTo,
      })
      if (error) throw error
    } else {
      const { error } = await adminClient.auth.resetPasswordForEmail(user.email, {
        redirectTo,
      })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /api/users/[id]/invite]", err)
    const message =
      err instanceof Error ? err.message : "Failed to send email."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
