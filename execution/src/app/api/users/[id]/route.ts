import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector, requireAuthenticated } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"
import { parseBody } from "@/lib/validations/parse"
import { UpdateUserSchema } from "@/lib/validations/user"
import type { Role } from "@/types"

// ── GET /api/users/[id] ──────────────────────────────────────────────────────
// Any authenticated user can fetch their own record. Admin/Director can fetch any.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuthenticated()
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const isAdmin = authUser.role === "admin" || authUser.role === "commercial_director"

  if (!isAdmin && authUser.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        division: true,
        isActive: true,
        isVp: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    console.error("[GET /api/users/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/users/[id] ────────────────────────────────────────────────────
// Admin/Director can update any user. Non-admin can only update their own name.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuthenticated()
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const isAdmin = authUser.role === "admin" || authUser.role === "commercial_director"

  // Non-admins can only update their own name — enforce before Zod parse
  // so we can inspect the raw key set without consuming the body twice.
  // We read the raw body first, then run Zod on it.
  let raw: Record<string, unknown>
  try {
    raw = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isAdmin) {
    if (authUser.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const forbidden = Object.keys(raw).filter((k) => k !== "name")
    if (forbidden.length > 0) {
      return NextResponse.json({ error: "Forbidden: can only update name" }, { status: 403 })
    }
  }

  // Run Zod against the already-parsed raw object
  const result = UpdateUserSchema.safeParse(raw)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
        return `${path}${issue.message}`
      })
      .join("; ")
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const body = result.data

  // Build update payload — only include fields present in body
  const updateData: {
    name?: string
    email?: string
    role?: Role
    division?: string | null
    isVp?: boolean
    isActive?: boolean
  } = {}

  if ("name" in body && body.name !== undefined) updateData.name = body.name.trim()
  if ("email" in body && body.email !== undefined) {
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
  if ("role" in body && body.role !== undefined) updateData.role = body.role
  if ("division" in body) {
    updateData.division =
      typeof body.division === "string" && body.division.trim()
        ? body.division.trim()
        : null
  }
  if ("isVp" in body && body.isVp !== undefined) updateData.isVp = body.isVp
  if ("isActive" in body && body.isActive !== undefined) updateData.isActive = body.isActive

  try {
    // Capture old email before update (needed for Supabase Auth sync)
    const existingEmail = updateData.email
      ? (await prisma.user.findUnique({ where: { id }, select: { email: true } }))?.email ?? null
      : null

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    // Sync email change to Supabase Auth — non-fatal
    if (updateData.email && existingEmail && updateData.email !== existingEmail) {
      try {
        const adminClient = createAdminClient()
        const { data: { users } } = await adminClient.auth.admin.listUsers()
        const supaUser = users?.find((u) => u.email === existingEmail)
        if (supaUser) {
          await adminClient.auth.admin.updateUserById(supaUser.id, { email: updateData.email })
        }
      } catch (syncErr) {
        console.error("[PATCH /api/users/[id]] Supabase email sync failed (non-fatal):", syncErr)
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
      prisma.lead.count({ where: { salesId: id, deletedAt: null } }),
      prisma.client.count({ where: { primaryAe: id, deletedAt: null } }),
    ])

    if (leadCount > 0 || clientCount > 0) {
      return NextResponse.json(
        { error: `User masih memiliki ${leadCount} lead dan ${clientCount} client. Reassign dulu sebelum menghapus.` },
        { status: 400 }
      )
    }

    await prisma.user.delete({ where: { id } })

    // Remove from Supabase Auth — non-fatal
    try {
      const adminClient = createAdminClient()
      const { data: supaUsers } = await adminClient.auth.admin.listUsers()
      const supaUser = supaUsers?.users?.find((u) => u.email === user.email)
      if (supaUser) {
        await adminClient.auth.admin.deleteUser(supaUser.id)
      }
    } catch (authErr) {
      console.error("[DELETE /api/users/[id]] Supabase auth delete failed (non-fatal):", authErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/users/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
