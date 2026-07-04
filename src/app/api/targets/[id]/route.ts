import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import { $Enums } from "@prisma/client"
import { parseBody } from "@/lib/validations/parse"
import { UpdateTargetSchema } from "@/lib/validations/target"

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeTarget(target: {
  id: string
  periodMonth: number
  periodYear: number
  revenueTarget: { toNumber?: () => number } | null
  newClientTarget: number
  type: $Enums.TargetType
  salesId: string | null
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
    salesId: target.salesId,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }
}

// ── PATCH /api/targets/[id] ──────────────────────────────────────────────────
// Accepts: revenueTarget, newClientTarget, salesId (all optional)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const parsed = await parseBody(UpdateTargetSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const existing = await prisma.target.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if ("revenueTarget" in body) updateData.revenueTarget = body.revenueTarget
    if ("newClientTarget" in body) updateData.newClientTarget = body.newClientTarget
    if ("salesId" in body) updateData.salesId = body.salesId

    const target = await prisma.target.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ target: serializeTarget(target) })
  } catch (err) {
    console.error("[PATCH /api/targets/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/targets/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.target.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 })
    }

    await prisma.target.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[DELETE /api/targets/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
