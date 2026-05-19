import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"

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

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Contact name is required" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email : null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

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
        name: (body.name as string).trim(),
        role: typeof body.role === "string" ? body.role || null : null,
        email: email || null,
        phone: typeof body.phone === "string" ? body.phone || null : null,
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
