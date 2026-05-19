import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ── PATCH /api/contacts/[contactId] ─────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { contactId } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if ("name" in body && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
  }

  const email = "email" in body
    ? (typeof body.email === "string" ? body.email : null)
    : undefined
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

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
    if ("name" in body) updateData.name = (body.name as string).trim()
    if ("role" in body) updateData.role = body.role ?? null
    if ("email" in body) updateData.email = email || null
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
