import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { Role } from "@/types"

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    select: { id: true, role: true },
  })
  if (!dbUser || dbUser.role !== "admin") return null
  return dbUser
}

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_ROLES: Role[] = ["admin", "account", "operation", "hr", "finance"]

function isRole(v: unknown): v is Role {
  return typeof v === "string" && VALID_ROLES.includes(v as Role)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── GET /api/users ──────────────────────────────────────────────────────────
// Returns active users — used for AE dropdown selects.

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
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
// Admin only. Creates a new user record.

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Required field validation
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!body.email || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }
  if (!isRole(body.role)) {
    return NextResponse.json(
      { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    )
  }

  const email = body.email.toLowerCase().trim()
  const name = body.name.trim()
  const role = body.role
  const division =
    typeof body.division === "string" && body.division.trim()
      ? body.division.trim()
      : null
  const isVp = body.isVp === true

  // Email uniqueness check
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  try {
    const user = await prisma.user.create({
      data: { name, email, role, division, isVp },
    })

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
