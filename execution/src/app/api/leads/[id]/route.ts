import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireCanCreateLeads, requireAdmin } from "@/lib/require-role"
import { syncClientStatus } from "@/lib/client-status"
import { parseBody } from "@/lib/validations/parse"
import { UpdateLeadSchema } from "@/lib/validations/lead"
import type { PipelineStage, ProductLine, ProjectType } from "@/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

function billingPlanToQuarter(billingPlan: string): string | null {
  const match = billingPlan.match(/^(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = 2000 + parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  if (month < 1 || month > 12) return null
  const q = Math.ceil(month / 3)
  return `Q${q} ${year}`
}

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeLead(lead: {
  id: string
  clientId: string
  productLine: ProductLine
  description: string | null
  projectType: ProjectType
  stage: PipelineStage
  salesId: string | null
  projectedRevenue: { toNumber?: () => number } | null
  billingPlan: string | null
  quarter: string | null
  actualRevenue: { toNumber?: () => number } | null
  lossDealReason: string | null
  invoiceRequestedAt: Date | null
  notes: string | null
  createdAt: Date
  closedAt: Date | null
  expectedCloseDate: Date | null
  updatedAt: Date
  client?: { id: string; name: string; customerCode?: string | null }
  sales?: { id: string; name: string } | null
  documents?: Array<{
    id: string
    leadId: string
    type: string
    fileUrl: string
    fileName: string | null
    uploadedAt: Date
    uploadedBy: string
    createdAt: Date
    uploader?: { id: string; name: string }
  }>
  stageHistory?: Array<{
    id: string
    leadId: string
    fromStage: PipelineStage
    toStage: PipelineStage
    changedBy: string
    changedAt: Date
    changer?: { id: string; name: string }
  }>
  fieldHistory?: Array<{
    id: string
    leadId: string
    field: string
    oldValue: string | null
    newValue: string | null
    changedBy: string
    changedAt: Date
    changer?: { id: string; name: string }
  }>
}) {
  return {
    ...lead,
    projectedRevenue: lead.projectedRevenue ? Number(lead.projectedRevenue) : null,
    actualRevenue: lead.actualRevenue ? Number(lead.actualRevenue) : null,
    invoiceRequestedAt: lead.invoiceRequestedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    closedAt: lead.closedAt?.toISOString() ?? null,
    expectedCloseDate: lead.expectedCloseDate?.toISOString() ?? null,
    updatedAt: lead.updatedAt.toISOString(),
    documents: lead.documents?.map((d) => ({
      ...d,
      uploadedAt: d.uploadedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
    stageHistory: lead.stageHistory?.map((h) => ({
      ...h,
      changedAt: h.changedAt.toISOString(),
    })),
    fieldHistory: lead.fieldHistory?.map((h) => ({
      ...h,
      changedAt: h.changedAt.toISOString(),
    })),
  }
}

// ── GET /api/leads/[id] ─────────────────────────────────────────────────────

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
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, customerCode: true } },
        sales: { select: { id: true, name: true } },
        documents: {
          include: { uploader: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        stageHistory: {
          include: { changer: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
        fieldHistory: {
          include: { changer: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    return NextResponse.json({ lead: serializeLead(lead) })
  } catch (err) {
    console.error("[GET /api/leads/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── PATCH /api/leads/[id] ───────────────────────────────────────────────────
// Admin/Director/Account can edit. Account role: own leads only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCanCreateLeads()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Ownership check for account role
  if (user.role === "account") {
    const lead = await prisma.lead.findUnique({ where: { id }, select: { salesId: true } })
    if (!lead || lead.salesId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const parsed = await parseBody(UpdateLeadSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  // "stage" changes must use the dedicated stage endpoint
  // UpdateLeadSchema doesn't include "stage", but guard against raw keys in body
  // (handled at schema level — stage not in schema, so Zod strips it with strict or passthrough)
  // We surface it explicitly to match existing error message
  if ("stage" in (parsed.data as Record<string, unknown>)) {
    return NextResponse.json(
      { error: "Stage changes must use POST /api/leads/[id]/stage" },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if ("clientId" in body) updateData.clientId = body.clientId
    if ("productLine" in body) updateData.productLine = body.productLine
    if ("description" in body) updateData.description = body.description ?? null
    if ("projectType" in body) updateData.projectType = body.projectType
    if ("salesId" in body) updateData.salesId = body.salesId ?? null
    if ("projectedRevenue" in body)
      updateData.projectedRevenue = body.projectedRevenue ?? null
    if ("billingPlan" in body) {
      updateData.billingPlan = body.billingPlan ?? null
      updateData.quarter = body.billingPlan
        ? billingPlanToQuarter(body.billingPlan)
        : null
    }
    if ("actualRevenue" in body) updateData.actualRevenue = body.actualRevenue ?? null
    if ("lossDealReason" in body) updateData.lossDealReason = body.lossDealReason ?? null
    if ("notes" in body) updateData.notes = body.notes ?? null
    if ("closedAt" in body) {
      updateData.closedAt = body.closedAt ? new Date(body.closedAt) : null
    }
    if ("expectedCloseDate" in body) {
      updateData.expectedCloseDate =
        typeof body.expectedCloseDate === "string" && body.expectedCloseDate
          ? new Date(body.expectedCloseDate)
          : null
    }

    // ── Detect field changes for history ────────────────────────────────────
    const TRACKED_FIELDS = ["projectedRevenue", "projectType", "billingPlan"] as const
    type TrackedField = (typeof TRACKED_FIELDS)[number]

    function toHistoryString(field: TrackedField, value: unknown): string | null {
      if (value === null || value === undefined) return null
      if (field === "projectedRevenue") {
        return String(Number(value))
      }
      return String(value)
    }

    const historyEntries: {
      leadId: string
      field: string
      oldValue: string | null
      newValue: string | null
      changedBy: string
    }[] = []

    for (const field of TRACKED_FIELDS) {
      if (field in updateData) {
        const oldRaw = existing[field]
        const newRaw = updateData[field]
        const oldStr = toHistoryString(field, oldRaw)
        const newStr = toHistoryString(field, newRaw)
        if (oldStr !== newStr) {
          historyEntries.push({
            leadId: id,
            field,
            oldValue: oldStr,
            newValue: newStr,
            changedBy: user.id,
          })
        }
      }
    }

    // ── Atomic: update lead + create history entries ─────────────────────────
    const [lead] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true, customerCode: true } },
          sales: { select: { id: true, name: true } },
          documents: {
            include: { uploader: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          stageHistory: {
            include: { changer: { select: { id: true, name: true } } },
            orderBy: { changedAt: "desc" },
          },
          fieldHistory: {
            include: { changer: { select: { id: true, name: true } } },
            orderBy: { changedAt: "desc" },
          },
        },
      }),
      ...historyEntries.map((entry) =>
        prisma.leadFieldHistory.create({ data: entry })
      ),
    ])

    return NextResponse.json({ lead: serializeLead(lead) })
  } catch (err) {
    console.error("[PATCH /api/leads/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/leads/[id] ──────────────────────────────────────────────────
// Admin only.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    await prisma.lead.delete({ where: { id } })

    try {
      await syncClientStatus(existing.clientId)
    } catch (err) {
      console.error("syncClientStatus failed after lead delete", err)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/leads/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
