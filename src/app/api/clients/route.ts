import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuthenticated, requireCanEditClients } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { CreateClientSchema, HealthStatusSchema, ClientStatusSchema } from "@/lib/validations/client"

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
  const archived = searchParams.get("archived") === "1"

  // Only admin can view archived records
  if (archived && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsedHealth = HealthStatusSchema.safeParse(health)
  const parsedStatus = ClientStatusSchema.safeParse(status)

  try {
    const where = {
      // Soft delete filter: default = active only; archived=1 = deleted only
      deletedAt: archived ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { industry: { contains: search, mode: "insensitive" as const } },
              { customerCode: { contains: search, mode: "insensitive" as const } },
              { ae: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
      ...(parsedHealth.success ? { healthStatus: parsedHealth.data } : {}),
      ...(parsedStatus.success ? { clientStatus: parsedStatus.data } : {}),
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
// Admin, Commercial Director, Account Manager, or Account.

export async function POST(request: NextRequest) {
  const user = await requireCanEditClients()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(CreateClientSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const client = await prisma.client.create({
      data: {
        name: body.name.trim(),
        industry: body.industry || null,
        orgSize: body.orgSize || null,
        engagementType: body.engagementType ?? "project",
        officeAddress: body.officeAddress || null,
        healthStatus: body.healthStatus ?? "healthy",
        clientStatus: body.clientStatus ?? "lead",
        primaryAe: body.primaryAe || null,
        customerCode:
          typeof body.customerCode === "string" && body.customerCode.trim()
            ? body.customerCode.trim()
            : null,
        notes: body.notes || null,
      },
      include: {
        ae: { select: { id: true, name: true } },
      },
    })

    // If initialContact provided, create it as the primary contact
    if (body.initialContact) {
      const { name, role, email, phone } = body.initialContact
      await prisma.contact.create({
        data: {
          clientId: client.id,
          name,
          role,
          email,
          phone: phone ?? null,
          isPrimary: true,
        },
      })
    }

    const normalized = {
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }

    return NextResponse.json({ client: normalized }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Customer code already in use" }, { status: 409 })
    }
    console.error("[POST /api/clients]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
