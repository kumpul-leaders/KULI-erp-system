import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector, requireAuthenticated } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"
import type { Role } from "@/types"

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_ROLES: Role[] = ["admin", "commercial_director", "account_manager", "account", "operation", "hr", "finance"]

function isRole(v: unknown): v is Role {
  return typeof v === "string" && VALID_ROLES.includes(v as Role)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── PATCH /api/users/[id] ────────────────────────────────────────────────────
// Admin only. Partial update of a user record.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const adminUser = await requireAdminOrDirector()
  const authUser = adminUser ?? await requireAuthenticated()
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Non-admins can only update their own name
  if (!adminUser) {
    if (authUser.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const forbidden = Object.keys(body).filter((k) => k !== "name")
    if (forbidden.length > 0) {
      return NextResponse.json({ error: "Forbidden: can only update name" }, { status: 403 })
    }
  }

  // Build update payload — only include fields present in body
  const updateData: {
    name?: string
    email?: string
    role?: Role
    division?: string | null
    isVp?: boolean
    isActive?: boolean
  } = {}

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
    }
    updateData.name = body.name.trim()
  }

  if ("email" in body) {
    if (typeof body.email !== "string" || !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }
    const email = body.email.toLowerCase().trim()
    // Uniqueness check excluding the current user
    const conflict = await prisma.user.findFirst({
      where: { email, NOT: { id } },
      select: { id: true },
    })
    if (conflict) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }
    updateData.email = email
  }

  if ("role" in body) {
    if (!isRole(body.role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      )
    }
    updateData.role = body.role
  }

  if ("division" in body) {
    updateData.division =
      typeof body.division === "string" && body.division.trim()
        ? body.division.trim()
        : null
  }

  if ("isVp" in body) {
    if (typeof body.isVp !== "boolean") {
      return NextResponse.json({ error: "isVp must be a boolean" }, { status: 400 })
    }
    updateData.isVp = body.isVp
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 })
    }
    updateData.isActive = body.isActive
  }

  try {
    // Capture old email before update (needed for Supabase Auth sync)
    const existingEmail = updateData.email
      ? (await prisma.user.findUnique({ where: { id }, select: { email: true } }))?.email ?? null
      : null

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    // Sync email change to Supabase Auth — non-fatal (follows same pattern as DELETE handler)
    if (updateData.email && existingEmail && updateData.email !== existingEmail) {
      const adminClient = createAdminClient()
      if (adminClient) {
        const { data: { users } } = await adminClient.auth.admin.listUsers()
        const supaUser = users?.find((u) => u.email === existingEmail)
        if (supaUser) {
          await adminClient.auth.admin.updateUserById(supaUser.id, { email: updateData.email })
        }
      }
    }

    return NextResponse.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    console.error("[PATCH /api/users/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/users/[id] ───────────────────────────────────────────────────
// Admin only. Hard-deletes an inactive user from DB + Supabase Auth.
// Blocked if user is still active or owns any leads/clients.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminOrDirector()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isActive: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: "Nonaktifkan user terlebih dahulu sebelum menghapus." },
        { status: 400 }
      )
    }

    const [leadCount, clientCount] = await Promise.all([
      prisma.lead.count({ where: { salesId: id } }),
      prisma.client.count({ where: { primaryAe: id } }),
    ])

    if (leadCount > 0 || clientCount > 0) {
      return NextResponse.json(
        { error: `User masih memiliki ${leadCount} lead dan ${clientCount} client. Reassign dulu sebelum menghapus.` },
        { status: 400 }
      )
    }

    await prisma.user.delete({ where: { id } })

    // Remove from Supabase Auth — non-fatal
    const adminClient = createAdminClient()
    if (adminClient) {
      const { data: supaUsers } = await adminClient.auth.admin.listUsers()
      const supaUser = supaUsers?.users?.find((u) => u.email === user.email)
      if (supaUser) {
        await adminClient.auth.admin.deleteUser(supaUser.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/users/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
