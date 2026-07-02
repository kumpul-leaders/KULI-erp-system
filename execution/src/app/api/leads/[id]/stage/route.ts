import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
import { syncClientStatus } from "@/lib/client-status"
import { parseBody } from "@/lib/validations/parse"
import { StageTransitionSchema } from "@/lib/validations/lead"
import { getStageConfig } from "@/lib/stage-config.server"
import type { PipelineStage } from "@/types"

// ── Gate logic ──────────────────────────────────────────────────────────────
// Server-enforced stage advance requirements.

interface GateCheckParams {
  fromStage: PipelineStage
  toStage: PipelineStage
  leadId: string
  lossDealReason?: string | null
}

async function checkGate(params: GateCheckParams): Promise<{ allowed: boolean; reason?: string }> {
  const { fromStage, toStage, leadId, lossDealReason } = params

  // Moving to lost_deal always allowed, but lossDealReason is required
  if (toStage === "lost_deal") {
    if (!lossDealReason?.trim()) {
      return { allowed: false, reason: "Loss deal reason is required when moving to Lost Deal" }
    }
    return { allowed: true }
  }

  // closed_won → invoiced must go via Request Invoice, not stage drag
  if (fromStage === "closed_won" && toStage === "invoiced") {
    return {
      allowed: false,
      reason: "Use the 'Request Invoice' button to move a deal to Invoiced",
    }
  }

  // leads → pipeline: requires at least 1 quotation document
  if (fromStage === "leads" && toStage === "pipeline") {
    const quotationCount = await prisma.pipelineDocument.count({
      where: { leadId, type: "quotation" },
    })
    if (quotationCount === 0) {
      return {
        allowed: false,
        reason: "Upload a Quotation document before moving to Pipeline",
      }
    }
  }

  // negotiation → closed_won: requires at least 1 signed quotation
  if (fromStage === "negotiation" && toStage === "closed_won") {
    const signedCount = await prisma.pipelineDocument.count({
      where: { leadId, type: "quotation_signed" },
    })
    if (signedCount === 0) {
      return {
        allowed: false,
        reason: "Upload a Signed Quotation document before moving to Closed Won",
      }
    }
  }

  return { allowed: true }
}

// ── POST /api/leads/[id]/stage ───────────────────────────────────────────────
// Advances or changes the stage of a lead with gate validation.
// Admin/Director/Account can move. Account role: own leads only.
// Body: { toStage: PipelineStage, lossDealReason?: string }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireCanCreateLeads()
  if (!authUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const parsed = await parseBody(StageTransitionSchema, request)
  if (parsed.error) return parsed.error

  const { toStage, lossDealReason, lostReason } = parsed.data

  try {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Ownership check for account role
    if (authUser.role === "account" && lead.salesId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const fromStage = lead.stage

    if (fromStage === toStage) {
      return NextResponse.json({ error: "Lead is already in this stage" }, { status: 400 })
    }

    // Run gate check
    const gate = await checkGate({ fromStage, toStage, leadId: id, lossDealReason: lossDealReason ?? lostReason })
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: 422 })
    }

    // Build lead update payload
    const updateData: Record<string, unknown> = { stage: toStage }
    if (toStage === "lost_deal") {
      updateData.lossDealReason = lossDealReason ?? (lostReason ?? null)
      updateData.lostReason = lostReason ?? null
      updateData.closedAt = new Date()
    }
    if (toStage === "closed_won") {
      updateData.closedAt = new Date()
    }

    // Auto-set probability from stage config unless manually overridden
    if (!lead.probabilityIsManual) {
      const stageConfig = await getStageConfig()
      updateData.probability = stageConfig[toStage].probability
    }

    // Atomic: update lead stage + create history record
    const [updatedLead] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true, customerCode: true } },
          sales: { select: { id: true, name: true } },
          documents: { orderBy: { createdAt: "desc" } },
          stageHistory: { orderBy: { changedAt: "desc" } },
        },
      }),
      prisma.leadStageHistory.create({
        data: {
          leadId: id,
          fromStage,
          toStage,
          changedBy: authUser.id,
        },
      }),
    ])

    // Sync client status — non-fatal if it fails
    try {
      await syncClientStatus(lead.clientId)
    } catch (syncErr) {
      console.error("[POST /api/leads/[id]/stage] syncClientStatus failed", syncErr)
    }

    return NextResponse.json({
      lead: {
        ...updatedLead,
        projectedRevenue: updatedLead.projectedRevenue
          ? Number(updatedLead.projectedRevenue)
          : null,
        actualRevenue: updatedLead.actualRevenue
          ? Number(updatedLead.actualRevenue)
          : null,
        probability: updatedLead.probability != null
          ? Number(updatedLead.probability)
          : null,
        invoiceRequestedAt:
          updatedLead.invoiceRequestedAt?.toISOString() ?? null,
        createdAt: updatedLead.createdAt.toISOString(),
        closedAt: updatedLead.closedAt?.toISOString() ?? null,
        updatedAt: updatedLead.updatedAt.toISOString(),
        documents: updatedLead.documents.map((d) => ({
          ...d,
          uploadedAt: d.uploadedAt.toISOString(),
          createdAt: d.createdAt.toISOString(),
        })),
        stageHistory: updatedLead.stageHistory.map((h) => ({
          ...h,
          changedAt: h.changedAt.toISOString(),
        })),
      },
      fromStage,
      toStage,
    })
  } catch (err) {
    console.error("[POST /api/leads/[id]/stage]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
