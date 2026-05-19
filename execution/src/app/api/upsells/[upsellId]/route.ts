import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { UpsellStatus } from "@/types"

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

const UPSELL_STATUSES: UpsellStatus[] = ["identified", "pitched", "won", "lost"]

function isUpsellStatus(v: unknown): v is UpsellStatus {
  return typeof v === "string" && UPSELL_STATUSES.includes(v as UpsellStatus)
}

// ── PATCH /api/upsells/[upsellId] ──────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ upsellId: string }> }
) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
