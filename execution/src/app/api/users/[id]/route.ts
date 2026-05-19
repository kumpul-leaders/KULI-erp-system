import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-role"
import type { Role } from "@/types"

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_ROLES: Role[] = ["admin", "commercial_director", "account", "operation", "hr", "finance"]

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
  const admin = await requireAdmin()
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
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

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
// Admin only. Soft-deactivates user (sets isActive = false). No hard delete.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/users/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
