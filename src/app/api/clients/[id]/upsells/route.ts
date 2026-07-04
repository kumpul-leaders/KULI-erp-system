import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { CreateUpsellSchema } from "@/lib/validations/upsell"

// ── POST /api/clients/[id]/upsells ──────────────────────────────────────────
// Admin or Commercial Director only.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: clientId } = await params

  const parsed = await parseBody(CreateUpsellSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const clientExists = await prisma.client.findUnique({ where: { id: clientId } })
    if (!clientExists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const upsell = await prisma.upsellOpportunity.create({
      data: {
        clientId,
        service: body.service.trim(),
        status: body.status ?? "identified",
        estimatedValue:
          typeof body.estimatedValue === "number" ? body.estimatedValue : null,
        notes: body.notes || null,
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
