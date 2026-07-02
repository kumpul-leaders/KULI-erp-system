import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireCanCreateLeads } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { CreateActivitySchema } from "@/lib/validations/activity"
import { recalcNextActivity } from "@/lib/activities"
import type { ActivityType, ActivityStatus } from "@prisma/client"

// ── Serializer ───────────────────────────────────────────────────────────────

function serializeActivity(activity: {
  id: string
  type: ActivityType
  subject: string
  note: string | null
  dueDate: Date
  status: ActivityStatus
  doneAt: Date | null
  leadId: string | null
  clientId: string | null
  assignedTo: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lead?: { id: string; client: { name: string } } | null
  client?: { id: string; name: string } | null
  assignee?: { id: string; name: string }
}) {
  return {
    ...activity,
    dueDate: activity.dueDate.toISOString().slice(0, 10), // date-only: YYYY-MM-DD
    doneAt: activity.doneAt?.toISOString() ?? null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  }
}

// ── Shared include shape ─────────────────────────────────────────────────────

const ACTIVITY_INCLUDE = {
  lead: {
    select: {
      id: true,
      client: { select: { name: true } },
    },
  },
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const

// ── GET /api/activities ──────────────────────────────────────────────────────
// Query params:
//   assignee  — UUID or "me" (resolves to the authenticated user's id)
//   status    — "open" | "done" | "canceled"
//   leadId    — UUID
//   clientId  — UUID
//   due       — "overdue" | "today" | "upcoming"
// Results sorted by dueDate asc.

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assigneeParam = searchParams.get("assignee") ?? ""
  const statusParam = searchParams.get("status") ?? ""
  const leadId = searchParams.get("leadId") ?? ""
  const clientId = searchParams.get("clientId") ?? ""
  const dueParam = searchParams.get("due") ?? ""

  const where: Record<string, unknown> = {}

  // assignee filter — "me" resolves to authenticated user
  if (assigneeParam) {
    where.assignedTo = assigneeParam === "me" ? user.id : assigneeParam
  }

  // status filter
  if (statusParam && ["open", "done", "canceled"].includes(statusParam)) {
    where.status = statusParam
  }

  if (leadId) where.leadId = leadId
  if (clientId) where.clientId = clientId

  // due filter — computes date range against dueDate
  if (dueParam) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dueParam === "overdue") {
      where.dueDate = { lt: today }
      where.status = "open" // overdue only makes sense for open activities
    } else if (dueParam === "today") {
      where.dueDate = { gte: today, lt: tomorrow }
    } else if (dueParam === "upcoming") {
      where.dueDate = { gte: tomorrow }
      where.status = "open"
    }
  }

  try {
    const activities = await prisma.activity.findMany({
      where,
      include: ACTIVITY_INCLUDE,
      orderBy: { dueDate: "asc" },
    })

    return NextResponse.json({
      activities: activities.map(serializeActivity),
      total: activities.length,
    })
  } catch (err) {
    console.error("[GET /api/activities]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/activities ─────────────────────────────────────────────────────
// Auth required. Role: admin, commercial_director, account_manager, account.
// Mirrors requireCanCreateLeads — same set of roles allowed to own pipeline actions.

export async function POST(request: NextRequest) {
  const user = await requireCanCreateLeads()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(CreateActivitySchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  try {
    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          type: body.type,
          subject: body.subject,
          note: body.note ?? null,
          dueDate: new Date(body.dueDate),
          leadId: body.leadId ?? null,
          clientId: body.clientId ?? null,
          assignedTo: body.assignedTo,
          createdBy: user.id,
        },
        include: ACTIVITY_INCLUDE,
      })

      // Maintain denormalized nextActivityAt on Lead
      if (body.leadId) {
        await recalcNextActivity(body.leadId, tx)
      }

      return created
    })

    return NextResponse.json({ activity: serializeActivity(activity) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/activities]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
