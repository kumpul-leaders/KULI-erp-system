import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
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

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Required field validation
  if (!body.clientId || typeof body.clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }
  if (!isProductLine(body.productLine)) {
    return NextResponse.json(
      { error: "Valid productLine is required" },
      { status: 400 }
    )
  }
  if (!isProjectType(body.projectType)) {
    return NextResponse.json(
      { error: "Valid projectType is required" },
      { status: 400 }
    )
  }

  // billingPlans array validation
  if (!Array.isArray(body.billingPlans)) {
    return NextResponse.json(
      { error: "billingPlans must be an array" },
      { status: 400 }
    )
  }
  const billingPlans = body.billingPlans as unknown[]
  if (billingPlans.length < 1 || billingPlans.length > 36) {
    return NextResponse.json(
      { error: "billingPlans must contain between 1 and 36 entries" },
      { status: 400 }
    )
  }
  for (const bp of billingPlans) {
    if (typeof bp !== "string" || !/^\d{2}-\d{2}$/.test(bp)) {
      return NextResponse.json(
        { error: `Invalid billingPlan entry: "${String(bp)}" — must be YY-MM format` },
        { status: 400 }
      )
    }
    const month = parseInt(bp.split("-")[1], 10)
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: `Invalid month in billingPlan entry: "${bp}"` },
        { status: 400 }
      )
    }
  }

  // stage defaults to leads
  const stage: PipelineStage = isPipelineStage(body.stage) ? body.stage : "leads"

  // Shared optional fields
  const description =
    typeof body.description === "string" && body.description
      ? body.description
      : null
  const salesId =
    typeof body.salesId === "string" && body.salesId ? body.salesId : null
  const projectedRevenue =
    typeof body.projectedRevenue === "number" ? body.projectedRevenue : null
  const notes =
    typeof body.notes === "string" && body.notes ? body.notes : null

  try {
    // Build one create operation per billing plan
    const creates = (billingPlans as string[]).map((bp) =>
      prisma.lead.create({
        data: {
          clientId: body.clientId as string,
          productLine: body.productLine as ProductLine,
          description,
          projectType: body.projectType as ProjectType,
          stage,
          salesId,
          projectedRevenue,
          billingPlan: bp,
          quarter: billingPlanToQuarter(bp),
          notes,
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
