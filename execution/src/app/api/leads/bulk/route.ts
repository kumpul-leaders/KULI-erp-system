import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { BulkCreateLeadSchema } from "@/lib/validations/lead"
import type { PipelineStage, ProductLine, ProjectType } from "@/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * billingPlan = "YY-MM" e.g. "26-08"
 * Returns "Q3 2026" or null if format is invalid.
 */
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
}) {
  return {
    ...lead,
    projectedRevenue: lead.projectedRevenue
      ? Number(lead.projectedRevenue)
      : null,
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
  }
}

// ── POST /api/leads/bulk ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await requireCanCreateLeads()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(BulkCreateLeadSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  // Additional month validity check per billingPlan entry
  for (const bp of body.billingPlans) {
    const month = parseInt(bp.split("-")[1], 10)
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: `Invalid month in billingPlan entry: "${bp}"` },
        { status: 400 }
      )
    }
  }

  const stage: PipelineStage = body.stage ?? "leads"

  try {
    const creates = body.billingPlans.map((bp) =>
      prisma.lead.create({
        data: {
          clientId: body.clientId,
          productLine: body.productLine,
          description: body.description || null,
          projectType: body.projectType,
          stage,
          salesId: body.salesId || null,
          projectedRevenue: body.projectedRevenue ?? null,
          billingPlan: bp,
          quarter: billingPlanToQuarter(bp),
          notes: body.notes || null,
          expectedCloseDate:
            typeof body.expectedCloseDate === "string" && body.expectedCloseDate
              ? new Date(body.expectedCloseDate)
              : null,
        },
        include: {
          client: { select: { id: true, name: true, customerCode: true } },
          sales: { select: { id: true, name: true } },
          documents: true,
          stageHistory: true,
        },
      })
    )

    // Array-form transaction — atomic; all succeed or all roll back
    const leads = await prisma.$transaction(creates)

    return NextResponse.json(
      { leads: leads.map(serializeLead), count: leads.length },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/leads/bulk]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
