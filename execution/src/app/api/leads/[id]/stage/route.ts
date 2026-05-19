import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { syncClientStatus } from "@/lib/client-status"
import type { PipelineStage } from "@/types"

// ── Auth helper ─────────────────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ── Validation ──────────────────────────────────────────────────────────────

const PIPELINE_STAGES: PipelineStage[] = [
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "lost_deal",
  "invoiced",
  "contract_renewal",
]

function isPipelineStage(v: unknown): v is PipelineStage {
  return typeof v === "string" && PIPELINE_STAGES.includes(v as PipelineStage)
}

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
// Body: { toStage: PipelineStage, lossDealReason?: string }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuth()
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isPipelineStage(body.toStage)) {
    return NextResponse.json({ error: "Valid toStage is required" }, { status: 400 })
  }

  const toStage = body.toStage
  const lossDealReason =
    typeof body.lossDealReason === "string" ? body.lossDealReason : null

  try {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const fromStage = lead.stage

    if (fromStage === toStage) {
      return NextResponse.json({ error: "Lead is already in this stage" }, { status: 400 })
    }

    // Run gate check
    const gate = await checkGate({ fromStage, toStage, leadId: id, lossDealReason })
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: 422 })
    }

    // Get the DB user record for changedBy FK
    const dbUser = await prisma.user.findUnique({
      where: { email: authUser.email! },
    })
    if (!dbUser) {
      return NextResponse.json(
        { error: "User record not found — cannot record stage change" },
        { status: 400 }
      )
    }

    // Build lead update payload
    const updateData: Record<string, unknown> = { stage: toStage }
    if (toStage === "lost_deal") {
      updateData.lossDealReason = lossDealReason
      updateData.closedAt = new Date()
    }
    if (toStage === "closed_won") {
      updateData.closedAt = new Date()
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
          changedBy: dbUser.id,
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
