import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { $Enums } from "@prisma/client"

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

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

// ── Validation helpers ──────────────────────────────────────────────────────

const TARGET_TYPES: $Enums.TargetType[] = ["monthly", "quarterly"]

function isTargetType(v: unknown): v is $Enums.TargetType {
  return typeof v === "string" && TARGET_TYPES.includes(v as $Enums.TargetType)
}

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeTarget(target: {
  id: string
  periodMonth: number
  periodYear: number
  revenueTarget: { toNumber?: () => number } | null
  newClientTarget: number
  type: $Enums.TargetType
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: target.id,
    periodMonth: target.periodMonth,
    periodYear: target.periodYear,
    revenueTarget: target.revenueTarget ? Number(target.revenueTarget) : 0,
    newClientTarget: target.newClientTarget,
    type: target.type,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }
}

// ── GET /api/targets ─────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const targets = await prisma.target.findMany({
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    })

    return NextResponse.json({ targets: targets.map(serializeTarget) })
  } catch (err) {
    console.error("[GET /api/targets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/targets (upsert) ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Required field validation
  if (typeof body.periodYear !== "number" || body.periodYear < 2020 || body.periodYear > 2100) {
    return NextResponse.json({ error: "periodYear must be a valid year" }, { status: 400 })
  }
  if (typeof body.revenueTarget !== "number" || body.revenueTarget < 0) {
    return NextResponse.json({ error: "revenueTarget must be a non-negative number" }, { status: 400 })
  }
  if (!isTargetType(body.type)) {
    return NextResponse.json({ error: "type must be 'monthly' or 'quarterly'" }, { status: 400 })
  }
  // Validate periodMonth range based on type — quarterly uses 1-4 (quarter number), monthly uses 1-12
  if (typeof body.periodMonth !== "number") {
    return NextResponse.json({ error: "periodMonth must be a number" }, { status: 400 })
  }
  const maxMonth = body.type === "quarterly" ? 4 : 12
  if (body.periodMonth < 1 || body.periodMonth > maxMonth) {
    return NextResponse.json(
      { error: body.type === "quarterly" ? "periodMonth must be 1-4 for quarterly targets" : "periodMonth must be 1-12 for monthly targets" },
      { status: 400 }
    )
  }

  const periodMonth = body.periodMonth
  const periodYear = body.periodYear
  const revenueTarget = body.revenueTarget
  const newClientTarget =
    typeof body.newClientTarget === "number" && body.newClientTarget >= 0
      ? body.newClientTarget
      : 0
  const type = body.type

  try {
    const target = await prisma.target.upsert({
      where: {
        periodMonth_periodYear_type: { periodMonth, periodYear, type },
      },
      update: { revenueTarget, newClientTarget },
      create: { periodMonth, periodYear, revenueTarget, newClientTarget, type },
    })

    return NextResponse.json({ target: serializeTarget(target) }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/targets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
