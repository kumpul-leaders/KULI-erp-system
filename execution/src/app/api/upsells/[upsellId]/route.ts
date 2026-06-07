import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import type { UpsellStatus } from "@/types"

const UPSELL_STATUSES: UpsellStatus[] = ["identified", "pitched", "won", "lost"]

function isUpsellStatus(v: unknown): v is UpsellStatus {
  return typeof v === "string" && UPSELL_STATUSES.includes(v as UpsellStatus)
}

// ── PATCH /api/upsells/[upsellId] ──────────────────────────────────────────
// Admin or Commercial Director only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ upsellId: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { upsellId } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (
    "service" in body &&
    (typeof body.service !== "string" || !body.service.trim())
  ) {
    return NextResponse.json({ error: "Service name cannot be empty" }, { status: 400 })
  }

  if ("status" in body && !isUpsellStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
  }

  try {
    const existing = await prisma.upsellOpportunity.findUnique({
      where: { id: upsellId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: "Upsell opportunity not found" },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if ("service" in body) updateData.service = (body.service as string).trim()
    if ("status" in body) updateData.status = body.status
    if ("estimatedValue" in body) updateData.estimatedValue = body.estimatedValue ?? null
    if ("notes" in body) updateData.notes = body.notes ?? null

    const upsell = await prisma.upsellOpportunity.update({
      where: { id: upsellId },
      data: updateData,
    })

    const normalized = {
      ...upsell,
      estimatedValue: upsell.estimatedValue ? Number(upsell.estimatedValue) : null,
      createdAt: upsell.createdAt.toISOString(),
      updatedAt: upsell.updatedAt.toISOString(),
    }

    return NextResponse.json({ upsell: normalized })
  } catch (err) {
    console.error("[PATCH /api/upsells/[upsellId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/upsells/[upsellId] ────────────────────────────────────────
// Admin or Commercial Director only.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ upsellId: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { upsellId } = await params
  try {
    const existing = await prisma.upsellOpportunity.findUnique({ where: { id: upsellId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.upsellOpportunity.delete({ where: { id: upsellId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[DELETE /api/upsells/[upsellId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
