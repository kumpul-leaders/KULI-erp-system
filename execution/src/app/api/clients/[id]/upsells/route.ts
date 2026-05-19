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

// ── POST /api/clients/[id]/upsells ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: clientId } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.service || typeof body.service !== "string" || !body.service.trim()) {
    return NextResponse.json({ error: "Service name is required" }, { status: 400 })
  }

  try {
    const clientExists = await prisma.client.findUnique({ where: { id: clientId } })
    if (!clientExists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const upsell = await prisma.upsellOpportunity.create({
      data: {
        clientId,
        service: (body.service as string).trim(),
        status: isUpsellStatus(body.status) ? body.status : "identified",
        estimatedValue:
          typeof body.estimatedValue === "number" ? body.estimatedValue : null,
        notes: typeof body.notes === "string" ? body.notes || null : null,
      },
    })

    const normalized = {
      ...upsell,
      estimatedValue: upsell.estimatedValue ? Number(upsell.estimatedValue) : null,
      createdAt: upsell.createdAt.toISOString(),
      updatedAt: upsell.updatedAt.toISOString(),
    }

    return NextResponse.json({ upsell: normalized }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/clients/[id]/upsells]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
