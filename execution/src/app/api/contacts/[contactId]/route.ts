import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { UpdateContactSchema } from "@/lib/validations/contact"

// ── PATCH /api/contacts/[contactId] ─────────────────────────────────────────
// Admin or Commercial Director only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contactId } = await params

  const parsed = await parseBody(UpdateContactSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const existing = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    // If setting as primary, clear other primary contacts for the same client
    if (body.isPrimary === true) {
      await prisma.contact.updateMany({
        where: { clientId: existing.clientId, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    const updateData: Record<string, unknown> = {}
    if ("name" in body) updateData.name = body.name!.trim()
    if ("role" in body) updateData.role = body.role ?? null
    if ("email" in body) updateData.email = body.email || null
    if ("phone" in body) updateData.phone = body.phone ?? null
    if ("isPrimary" in body) updateData.isPrimary = Boolean(body.isPrimary)

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    })

    return NextResponse.json({
      contact: { ...contact, createdAt: contact.createdAt.toISOString() },
    })
  } catch (err) {
    console.error("[PATCH /api/contacts/[contactId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/contacts/[contactId] ────────────────────────────────────────
// Admin or Commercial Director only.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { contactId } = await params

  try {
    const existing = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await prisma.contact.delete({ where: { id: contactId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/contacts/[contactId]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
