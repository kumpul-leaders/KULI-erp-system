import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireCanCreateLeads, requireAdmin } from "@/lib/require-role"
import { syncClientStatus } from "@/lib/client-status"
import type { PipelineStage, ProductLine, ProjectType } from "@/types"

// ── Validation helpers ──────────────────────────────────────────────────────

const PIPELINE_STAGES: PipelineStage[] = [
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "lost_deal",
  "invoiced",
  "contract_renewal",
]

const PRODUCT_LINES: ProductLine[] = [
  "stracomm",
  "smm",
  "creative_strategy",
  "media_buying",
  "ads_management",
  "production",
  "others",
]

const PROJECT_TYPES: ProjectType[] = ["one_time", "retainer"]

function isPipelineStage(v: unknown): v is PipelineStage {
  return typeof v === "string" && PIPELINE_STAGES.includes(v as PipelineStage)
}

function isProductLine(v: unknown): v is ProductLine {
  return typeof v === "string" && PRODUCT_LINES.includes(v as ProductLine)
}

function isProjectType(v: unknown): v is ProjectType {
  return typeof v === "string" && PROJECT_TYPES.includes(v as ProjectType)
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeLead(lead: any) {
  return {
    ...lead,
    projectedRevenue: lead.projectedRevenue ? Number(lead.projectedRevenue) : null,
    actualRevenue: lead.actualRevenue ? Number(lead.actualRevenue) : null,
    invoiceRequestedAt: lead.invoiceRequestedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    closedAt: lead.closedAt?.toISOString() ?? null,
    expectedCloseDate: lead.expectedCloseDate?.toISOString() ?? null,
    updatedAt: lead.updatedAt.toISOString(),
    documents: lead.documents?.map((d: { uploadedAt: Date; createdAt: Date; [key: string]: unknown }) => ({
      ...d,
      uploadedAt: d.uploadedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
    stageHistory: lead.stageHistory?.map((h: { changedAt: Date; [key: string]: unknown }) => ({
      ...h,
      changedAt: h.changedAt.toISOString(),
    })),
    fieldHistory: lead.fieldHistory?.map((h: { changedAt: Date; [key: string]: unknown }) => ({
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

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate enum fields if provided
  if ("productLine" in body && !isProductLine(body.productLine)) {
    return NextResponse.json({ error: "Invalid productLine" }, { status: 400 })
  }
  if ("projectType" in body && !isProjectType(body.projectType)) {
    return NextResponse.json({ error: "Invalid projectType" }, { status: 400 })
  }
  if ("stage" in body && !isPipelineStage(body.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
  }

  // billingPlan format validation
  if ("billingPlan" in body && body.billingPlan !== null) {
    if (
      typeof body.billingPlan !== "string" ||
      !/^\d{2}-\d{2}$/.test(body.billingPlan)
    ) {
      return NextResponse.json(
        { error: "billingPlan must be in YY-MM format (e.g. 26-08)" },
        { status: 400 }
      )
    }
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
    if ("stage" in body) updateData.stage = body.stage
    if ("salesId" in body) updateData.salesId = body.salesId ?? null
    if ("projectedRevenue" in body)
      updateData.projectedRevenue = body.projectedRevenue ?? null
    if ("billingPlan" in body) {
      updateData.billingPlan = body.billingPlan ?? null
      updateData.quarter = body.billingPlan
        ? billingPlanToQuarter(body.billingPlan as string)
        : null
    }
    if ("actualRevenue" in body) updateData.actualRevenue = body.actualRevenue ?? null
    if ("lossDealReason" in body) updateData.lossDealReason = body.lossDealReason ?? null
    if ("notes" in body) updateData.notes = body.notes ?? null
    if ("closedAt" in body) {
      updateData.closedAt = body.closedAt ? new Date(body.closedAt as string) : null
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
        // Prisma Decimal — convert to plain number string
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
        // Only record if value actually changed
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

    // If stage was updated, sync client status — non-fatal if it fails
    if ("stage" in body) {
      try {
        await syncClientStatus(existing.clientId)
      } catch (syncErr) {
        console.error("[PATCH /api/leads/[id]] syncClientStatus failed", syncErr)
      }
    }

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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/leads/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
