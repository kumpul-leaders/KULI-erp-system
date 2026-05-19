import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireAdminOrDirector } from "@/lib/require-role"
import type { HealthStatus, EngagementType, ClientStatus } from "@/types"

const ENGAGEMENT_TYPES: EngagementType[] = ["retainer", "project", "both"]
const HEALTH_STATUSES: HealthStatus[] = ["healthy", "at_risk", "churned"]
const CLIENT_STATUSES: ClientStatus[] = ["active", "inactive", "lead"]

function isEngagementType(v: unknown): v is EngagementType {
  return typeof v === "string" && ENGAGEMENT_TYPES.includes(v as EngagementType)
}

function isHealthStatus(v: unknown): v is HealthStatus {
  return typeof v === "string" && HEALTH_STATUSES.includes(v as HealthStatus)
}

function isClientStatus(v: unknown): v is ClientStatus {
  return typeof v === "string" && CLIENT_STATUSES.includes(v as ClientStatus)
}

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
      where: { id },
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
      monthlyValue: client.monthlyValue ? Number(client.monthlyValue) : null,
      annualValue: client.annualValue ? Number(client.annualValue) : null,
      contractStart: client.contractStart?.toISOString() ?? null,
      contractEnd: client.contractEnd?.toISOString() ?? null,
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
// Admin or Commercial Director only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate name if provided
  if ("name" in body && (typeof body.name !== "string" || !body.name.trim())) {
    return NextResponse.json({ error: "Client name cannot be empty" }, { status: 400 })
  }
  // Validate engagementType if provided
  if ("engagementType" in body && !isEngagementType(body.engagementType)) {
    return NextResponse.json({ error: "Invalid engagement type" }, { status: 400 })
  }
  // Validate healthStatus if provided
  if ("healthStatus" in body && !isHealthStatus(body.healthStatus)) {
    return NextResponse.json({ error: "Invalid health status" }, { status: 400 })
  }
  // Validate clientStatus if provided
  if ("clientStatus" in body && !isClientStatus(body.clientStatus)) {
    return NextResponse.json({ error: "Invalid client status" }, { status: 400 })
  }

  // Build update payload — only include fields that were sent
  const updateData: Record<string, unknown> = {}
  if ("name" in body) updateData.name = (body.name as string).trim()
  if ("industry" in body) updateData.industry = body.industry ?? null
  if ("orgSize" in body) updateData.orgSize = body.orgSize ?? null
  if ("engagementType" in body) updateData.engagementType = body.engagementType
  if ("healthStatus" in body) updateData.healthStatus = body.healthStatus
  if ("clientStatus" in body) updateData.clientStatus = body.clientStatus
  if ("primaryAe" in body) updateData.primaryAe = body.primaryAe ?? null
  if ("notes" in body) updateData.notes = body.notes ?? null
  if ("monthlyValue" in body) updateData.monthlyValue = body.monthlyValue ?? null
  if ("annualValue" in body) updateData.annualValue = body.annualValue ?? null
  if ("contractStart" in body) {
    updateData.contractStart =
      typeof body.contractStart === "string" && body.contractStart
        ? new Date(body.contractStart)
        : null
  }
  if ("contractEnd" in body) {
    updateData.contractEnd =
      typeof body.contractEnd === "string" && body.contractEnd
        ? new Date(body.contractEnd)
        : null
  }

  // Validate contract date order if both present in update
  if (updateData.contractStart && updateData.contractEnd) {
    if (
      new Date(updateData.contractEnd as string) <=
      new Date(updateData.contractStart as string)
    ) {
      return NextResponse.json(
        { error: "Contract end must be after contract start" },
        { status: 400 }
      )
    }
  }

  try {
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
      include: {
        ae: { select: { id: true, name: true } },
      },
    })

    const normalized = {
      ...client,
      monthlyValue: client.monthlyValue ? Number(client.monthlyValue) : null,
      annualValue: client.annualValue ? Number(client.annualValue) : null,
      contractStart: client.contractStart?.toISOString() ?? null,
      contractEnd: client.contractEnd?.toISOString() ?? null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }

    return NextResponse.json({ client: normalized })
  } catch (err) {
    console.error("[PATCH /api/clients/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/clients/[id] ────────────────────────────────────────────────
// Admin or Commercial Director only.

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
    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    await prisma.client.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/clients/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
