import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { CreateContactSchema } from "@/lib/validations/contact"

// ── POST /api/clients/[id]/contacts ─────────────────────────────────────────
// Admin or Commercial Director only (contacts are client data).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: clientId } = await params

  const parsed = await parseBody(CreateContactSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const clientExists = await prisma.client.findUnique({ where: { id: clientId } })
    if (!clientExists) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const isPrimary = Boolean(body.isPrimary)

    // Clear other primary contacts if setting this one as primary
    if (isPrimary) {
      await prisma.contact.updateMany({
        where: { clientId },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.contact.create({
      data: {
        clientId,
        name: body.name.trim(),
        role: body.role || null,
        email: body.email || null,
        phone: body.phone || null,
        isPrimary,
      },
    })

    return NextResponse.json(
      { contact: { ...contact, createdAt: contact.createdAt.toISOString() } },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/clients/[id]/contacts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
