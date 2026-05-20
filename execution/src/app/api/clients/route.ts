import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireAdminOrDirector } from "@/lib/require-role"
import type { HealthStatus, EngagementType, ClientStatus } from "@/types"

// ── Validation helpers ──────────────────────────────────────────────────────

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

// ── GET /api/clients ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search") ?? ""
  const health = searchParams.get("health") ?? ""
  const industry = searchParams.get("industry") ?? ""
  const status = searchParams.get("status") ?? ""

  try {
    const where = {
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
      ...(isHealthStatus(health)
        ? { healthStatus: health }
        : {}),
      ...(isClientStatus(status)
        ? { clientStatus: status }
        : {}),
      ...(industry
        ? { industry: { contains: industry, mode: "insensitive" as const } }
        : {}),
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          ae: { select: { id: true, name: true } },
          contacts: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.count({ where }),
    ])

    const normalized = clients.map((c) => ({
      ...c,
      monthlyValue: c.monthlyValue ? Number(c.monthlyValue) : null,
      annualValue: c.annualValue ? Number(c.annualValue) : null,
      contractStart: c.contractStart?.toISOString() ?? null,
      contractEnd: c.contractEnd?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      _contactCount: c.contacts.length,
    }))

    return NextResponse.json({ clients: normalized, total })
  } catch (err) {
    console.error("[GET /api/clients]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/clients ───────────────────────────────────────────────────────
// Admin or Commercial Director only.

export async function POST(request: NextRequest) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate required fields
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 })
  }
  if (!isEngagementType(body.engagementType)) {
    return NextResponse.json({ error: "Valid engagement type is required" }, { status: 400 })
  }

  // Validate contract dates
  if (body.contractStart && body.contractEnd) {
    if (new Date(body.contractEnd as string) <= new Date(body.contractStart as string)) {
      return NextResponse.json(
        { error: "Contract end must be after contract start" },
        { status: 400 }
      )
    }
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: (body.name as string).trim(),
        industry: typeof body.industry === "string" && body.industry ? body.industry : null,
        orgSize: typeof body.orgSize === "string" && body.orgSize ? body.orgSize : null,
        engagementType: body.engagementType,
        contractStart:
          typeof body.contractStart === "string" && body.contractStart
            ? new Date(body.contractStart)
            : null,
        contractEnd:
          typeof body.contractEnd === "string" && body.contractEnd
            ? new Date(body.contractEnd)
            : null,
        monthlyValue:
          typeof body.monthlyValue === "number" ? body.monthlyValue : null,
        annualValue:
          typeof body.annualValue === "number" ? body.annualValue : null,
        healthStatus: isHealthStatus(body.healthStatus)
          ? body.healthStatus
          : "healthy",
        clientStatus: isClientStatus(body.clientStatus)
          ? body.clientStatus
          : "lead",
        primaryAe:
          typeof body.primaryAe === "string" && body.primaryAe
            ? body.primaryAe
            : null,
        notes:
          typeof body.notes === "string" && body.notes
            ? body.notes
            : null,
      },
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

    return NextResponse.json({ client: normalized }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/clients]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
