import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAdmin, requireAuthenticated, requireAdminOrDirector, requireCanEditClients } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { UpdateClientSchema } from "@/lib/validations/client"

// ── GET /api/clients/[id] ───────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const client = await prisma.client.findUnique({
      where: { id, deletedAt: null },
      include: {
        ae: { select: { id: true, name: true, email: true } },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        upsellOpportunities: { orderBy: { createdAt: "desc" } },
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const normalized = {
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      contacts: client.contacts.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      upsellOpportunities: client.upsellOpportunities.map((u) => ({
        ...u,
        estimatedValue: u.estimatedValue ? Number(u.estimatedValue) : null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
    }

    return NextResponse.json({ client: normalized })
  } catch (err) {
    console.error("[GET /api/clients/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/clients/[id] ─────────────────────────────────────────────────
// account_manager and account can update healthStatus/clientStatus. Admins/directors can update all fields.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCanEditClients()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const isAdminOrDirector = user.role === "admin" || user.role === "commercial_director"

  const { id } = await params

  // ── Restore action (admin only) ────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (
    rawBody !== null &&
    typeof rawBody === "object" &&
    "restore" in rawBody &&
    (rawBody as Record<string, unknown>).restore === true
  ) {
    const adminUser = await requireAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }
    if (client.deletedAt === null) {
      return NextResponse.json({ error: "Client is not archived" }, { status: 409 })
    }
    await prisma.client.update({ where: { id }, data: { deletedAt: null } })
    return NextResponse.json({ success: true })
  }

  const parsedBody = UpdateClientSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsedBody.error.issues },
      { status: 422 }
    )
  }

  const body = parsedBody.data

  // Non-admin/director: can only update healthStatus or clientStatus
  if (!isAdminOrDirector) {
    const ALLOWED_FIELDS = new Set(["healthStatus", "clientStatus"])
    const requestedKeys = Object.keys(body)
    const forbidden = requestedKeys.filter((k) => !ALLOWED_FIELDS.has(k))
    if (forbidden.length > 0) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }
  }

  // Build update payload — only include fields that were sent
  const updateData: Record<string, unknown> = {}
  if ("name" in body) updateData.name = body.name!.trim()
  if ("customerCode" in body) {
    updateData.customerCode =
      typeof body.customerCode === "string" && body.customerCode.trim()
        ? body.customerCode.trim()
        : null
  }
  if ("industry" in body) updateData.industry = body.industry ?? null
  if ("orgSize" in body) updateData.orgSize = body.orgSize ?? null
  if ("officeAddress" in body) updateData.officeAddress = body.officeAddress ?? null
  if ("engagementType" in body) updateData.engagementType = body.engagementType
  if ("healthStatus" in body) updateData.healthStatus = body.healthStatus
  if ("clientStatus" in body) updateData.clientStatus = body.clientStatus
  if ("primaryAe" in body) updateData.primaryAe = body.primaryAe ?? null
  if ("notes" in body) updateData.notes = body.notes ?? null

  try {
    const existing = await prisma.client.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Compute changed fields for audit log
    const auditEntries: Array<{
      clientId: string
      field: string
      oldValue: string | null
      newValue: string | null
      changedBy: string
    }> = []

    const TRACKED: Record<string, (v: unknown) => string | null> = {
      name: (v) => (v as string | null) ?? null,
      customerCode: (v) => (v as string | null) ?? null,
      industry: (v) => (v as string | null) ?? null,
      orgSize: (v) => (v as string | null) ?? null,
      officeAddress: (v) => (v as string | null) ?? null,
      engagementType: (v) => (v as string | null) ?? null,
      healthStatus: (v) => (v as string | null) ?? null,
      clientStatus: (v) => (v as string | null) ?? null,
      primaryAe: (v) => (v as string | null) ?? null,
      notes: (v) => (v as string | null) ?? null,
    }

    for (const [field, serializer] of Object.entries(TRACKED)) {
      if (!(field in updateData)) continue
      const oldVal = serializer((existing as Record<string, unknown>)[field])
      const newVal = serializer(updateData[field])
      if (oldVal !== newVal) {
        auditEntries.push({ clientId: id, field, oldValue: oldVal, newValue: newVal, changedBy: user.id })
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        ae: { select: { id: true, name: true } },
      },
    })

    if (auditEntries.length > 0) {
      await prisma.clientFieldHistory.createMany({ data: auditEntries })
    }

    const normalized = {
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }

    return NextResponse.json({ client: normalized })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Customer code already in use" }, { status: 409 })
    }
    console.error("[PATCH /api/clients/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/clients/[id] ────────────────────────────────────────────────
// Admin or Commercial Director only. Soft delete — sets deletedAt.

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
    const existing = await prisma.client.findUnique({ where: { id, deletedAt: null } })
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const activeLeadCount = await prisma.lead.count({
      where: {
        clientId: id,
        deletedAt: null,
        stage: { notIn: ["lost_deal", "invoiced", "no_response"] },
      },
    })
    if (activeLeadCount > 0) {
      return NextResponse.json(
        { error: `Client ini masih punya ${activeLeadCount} lead aktif di pipeline. Pindahkan atau selesaikan lead tersebut terlebih dahulu.` },
        { status: 409 }
      )
    }

    await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/clients/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
