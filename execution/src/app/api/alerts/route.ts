import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import type { AlertStatus, AlertType } from "@prisma/client"

// ── GET /api/alerts ──────────────────────────────────────────────────────────
// Query params:
//   status  = open | acknowledged | resolved
//   clientId = UUID
// Returns: { alerts: Alert[], total: number }

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status") ?? ""
  const clientIdParam = searchParams.get("clientId") ?? ""

  const VALID_STATUSES: AlertStatus[] = ["open", "acknowledged", "resolved"]
  const statusFilter = VALID_STATUSES.includes(statusParam as AlertStatus)
    ? (statusParam as AlertStatus)
    : undefined

  try {
    const alerts = await prisma.alert.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(clientIdParam ? { clientId: clientIdParam } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, description: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { triggeredAt: "desc" },
    })

    const serialized = alerts.map((a) => ({
      id: a.id,
      type: a.type as AlertType,
      status: a.status as AlertStatus,
      dedupeKey: a.dedupeKey,
      triggeredAt: a.triggeredAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      client: a.client
        ? { id: a.client.id, name: a.client.name }
        : null,
      lead: a.lead
        ? { id: a.lead.id, description: a.lead.description }
        : null,
      assignee: a.assignee
        ? { id: a.assignee.id, name: a.assignee.name }
        : null,
    }))

    return NextResponse.json({ alerts: serialized, total: serialized.length })
  } catch (err) {
    console.error("[GET /api/alerts]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
