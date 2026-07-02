import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireCanCreateLeads } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { PipelineStageSchema, CreateLeadSchema } from "@/lib/validations/lead"
import { getStageConfig } from "@/lib/stage-config.server"
import { createNotification } from "@/lib/notifications"
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
  probability: { toNumber?: () => number } | null
  probabilityIsManual: boolean
  lostReason: string | null
  lossDealReason: string | null
  invoiceRequestedAt: Date | null
  notes: string | null
  createdAt: Date
  closedAt: Date | null
  expectedCloseDate: Date | null
  updatedAt: Date
  nextActivityAt?: Date | null
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
    probability: lead.probability != null ? Number(lead.probability) : null,
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
    nextActivityAt: lead.nextActivityAt?.toISOString() ?? null,
    stageHistory: lead.stageHistory?.map((h) => ({
      ...h,
      changedAt: h.changedAt.toISOString(),
    })),
  }
}

// ── GET /api/leads ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get("stage") ?? ""
  const salesId = searchParams.get("salesId") ?? ""
  const clientId = searchParams.get("clientId") ?? ""
  const search = searchParams.get("search") ?? ""

  const parsedStage = PipelineStageSchema.safeParse(stage)

  try {
    const where: Record<string, unknown> = {}
    if (parsedStage.success) where.stage = parsedStage.data
    if (salesId) where.salesId = salesId
    if (clientId) where.clientId = clientId
    if (search) {
      where.client = {
        name: { contains: search, mode: "insensitive" },
      }
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, customerCode: true } },
        sales: { select: { id: true, name: true } },
        documents: {
          select: {
            id: true,
            leadId: true,
            type: true,
            fileUrl: true,
            fileName: true,
            uploadedAt: true,
            uploadedBy: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      leads: leads.map(serializeLead),
      total: leads.length,
    })
  } catch (err) {
    console.error("[GET /api/leads]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/leads ─────────────────────────────────────────────────────────
// Admin, Commercial Director, or Account can create leads.

export async function POST(request: NextRequest) {
  const user = await requireCanCreateLeads()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(CreateLeadSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  const billingPlan = body.billingPlan ?? null
  const quarter = billingPlan ? billingPlanToQuarter(billingPlan) : null
  const stage: PipelineStage = body.stage ?? "leads"

  // Resolve initial probability from stage config
  const stageConfig = await getStageConfig()
  const initialProbability = stageConfig[stage].probability

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          clientId: body.clientId,
          productLine: body.productLine,
          description: body.description || null,
          projectType: body.projectType,
          stage,
          salesId: body.salesId || null,
          projectedRevenue: body.projectedRevenue ?? null,
          billingPlan,
          quarter,
          notes: body.notes || null,
          expectedCloseDate:
            typeof body.expectedCloseDate === "string" && body.expectedCloseDate
              ? new Date(body.expectedCloseDate)
              : null,
          probability: initialProbability,
          probabilityIsManual: false,
        },
        include: {
          client: { select: { id: true, name: true, customerCode: true } },
          sales: { select: { id: true, name: true } },
          documents: true,
          stageHistory: true,
        },
      })

      // Auto-follow: creator + salesId (if set) become followers of the new lead
      const autoFollowIds = [...new Set([user.id, body.salesId].filter(Boolean))] as string[]
      for (const uid of autoFollowIds) {
        await tx.follower.upsert({
          where: { userId_leadId: { userId: uid, leadId: created.id } },
          create: { userId: uid, leadId: created.id },
          update: {},
        })
      }

      // lead_assigned: notify sales if assigned and not the creator
      if (body.salesId && body.salesId !== user.id) {
        const clientName = created.client?.name ?? ""
        await createNotification(
          {
            userId: body.salesId,
            type: "lead_assigned",
            title: `Lu di-assign lead ${clientName}`,
            entityType: "lead",
            entityId: created.id,
            actorId: user.id,
          },
          tx
        )
      }

      return created
    })

    return NextResponse.json({ lead: serializeLead(lead) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/leads]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
