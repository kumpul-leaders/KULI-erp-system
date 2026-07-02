import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { UpdateActivitySchema, ActionSchema } from "@/lib/validations/activity"
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
    dueDate: activity.dueDate.toISOString().slice(0, 10),
    doneAt: activity.doneAt?.toISOString() ?? null,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  }
}

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

// ── Permission helper ─────────────────────────────────────────────────────────
// Assignee, creator, admin, or commercial_director may mutate an activity.

function canMutate(
  user: { id: string; role: string },
  activity: { assignedTo: string; createdBy: string }
): boolean {
  if (["admin", "commercial_director"].includes(user.role)) return true
  return user.id === activity.assignedTo || user.id === activity.createdBy
}

// ── PATCH /api/activities/[id] ───────────────────────────────────────────────
// Two modes determined by presence of "action" key in body:
//
//   { action: "done" | "cancel" | "reopen" }
//     → action mode: update status / doneAt
//
//   { type?, subject?, note?, dueDate?, assignedTo? }
//     → field update mode: reschedule or edit
//
// Permission: assignee, creator, admin, or commercial_director.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.activity.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  }

  if (!canMutate(user, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Peek at body to determine mode
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const isActionMode =
    rawBody !== null &&
    typeof rawBody === "object" &&
    "action" in (rawBody as object)

  try {
    if (isActionMode) {
      // ── Action mode ────────────────────────────────────────────────────────
      const parsedAction = ActionSchema.safeParse(rawBody)
      if (!parsedAction.success) {
        const message = parsedAction.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
        return NextResponse.json({ error: message }, { status: 400 })
      }

      const { action } = parsedAction.data
      const updateData: Record<string, unknown> = {}

      if (action === "done") {
        updateData.status = "done"
        updateData.doneAt = new Date()
      } else if (action === "cancel") {
        updateData.status = "canceled"
      } else if (action === "reopen") {
        updateData.status = "open"
        updateData.doneAt = null
      }

      const activity = await prisma.$transaction(async (tx) => {
        const updated = await tx.activity.update({
          where: { id },
          data: updateData,
          include: ACTIVITY_INCLUDE,
        })

        if (existing.leadId) {
          await recalcNextActivity(existing.leadId, tx)
        }

        return updated
      })

      return NextResponse.json({ activity: serializeActivity(activity) })
    } else {
      // ── Field update mode ──────────────────────────────────────────────────
      const parsedUpdate = UpdateActivitySchema.safeParse(rawBody)
      if (!parsedUpdate.success) {
        const message = parsedUpdate.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
        return NextResponse.json({ error: message }, { status: 400 })
      }

      const body = parsedUpdate.data
      const updateData: Record<string, unknown> = {}

      if ("type" in body) updateData.type = body.type
      if ("subject" in body) updateData.subject = body.subject
      if ("note" in body) updateData.note = body.note ?? null
      if ("assignedTo" in body) updateData.assignedTo = body.assignedTo
      if ("dueDate" in body && body.dueDate) {
        updateData.dueDate = new Date(body.dueDate)
      }

      const activity = await prisma.$transaction(async (tx) => {
        const updated = await tx.activity.update({
          where: { id },
          data: updateData,
          include: ACTIVITY_INCLUDE,
        })

        // Reschedule changes dueDate — recalc nextActivityAt
        if (existing.leadId && "dueDate" in body) {
          await recalcNextActivity(existing.leadId, tx)
        }

        return updated
      })

      return NextResponse.json({ activity: serializeActivity(activity) })
    }
  } catch (err) {
    console.error("[PATCH /api/activities/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
