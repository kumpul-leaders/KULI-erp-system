import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireAdminOrDirector } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"
import { getAppUrl } from "@/lib/app-url"
import { parseBody } from "@/lib/validations/parse"
import { CreateUserSchema } from "@/lib/validations/user"

// ── GET /api/users ──────────────────────────────────────────────────────────
// Returns active users — used for AE dropdown selects.

export async function GET() {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, division: true },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ users })
  } catch (err) {
    console.error("[GET /api/users]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/users ──────────────────────────────────────────────────────────
// Admin only. Creates a new user record + sends Supabase invite email.

export async function POST(request: NextRequest) {
  const admin = await requireAdminOrDirector()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(CreateUserSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  const email = body.email.toLowerCase().trim()
  const name = body.name.trim()
  const role = body.role
  const division =
    typeof body.division === "string" && body.division.trim()
      ? body.division.trim()
      : null
  const isVp = body.isVp === true

  // Email uniqueness check — block only if active
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing?.isActive) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const redirectTo = `${getAppUrl()}/api/auth/callback?next=${encodeURIComponent("/set-password?flow=invite")}`

  const sendInvite = async () => {
    const adminClient = createAdminClient()
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (inviteError) {
      console.error("[POST /api/users] Supabase invite failed:", inviteError.message)
    }
  }

  // Reactivate soft-deleted user
  if (existing && !existing.isActive) {
    try {
      const user = await prisma.user.update({
        where: { email },
        data: { name, role, division, isVp, isActive: true },
      })
      await sendInvite()
      return NextResponse.json(
        {
          user: {
            ...user,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          reactivated: true,
        },
        { status: 200 }
      )
    } catch (err) {
      console.error("[POST /api/users] reactivate failed:", err)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  try {
    const user = await prisma.user.create({
      data: { name, email, role, division, isVp },
    })
    await sendInvite()
    return NextResponse.json(
      {
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/users]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
