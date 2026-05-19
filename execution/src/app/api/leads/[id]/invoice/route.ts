import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
import { syncClientStatus } from "@/lib/client-status"

// ── POST /api/leads/[id]/invoice ────────────────────────────────────────────
// Request invoice: sets invoiceRequestedAt = now(), stage → invoiced.
// Admin/Director/Account can request. Account role: own leads only.
// Only allowed when stage === 'closed_won' AND invoiceRequestedAt is null.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireCanCreateLeads()
  if (!authUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Ownership check for account role
    if (authUser.role === "account" && lead.salesId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (lead.stage !== "closed_won") {
      return NextResponse.json(
        { error: "Invoice can only be requested from the Closed Won stage" },
        { status: 422 }
      )
    }

    if (lead.invoiceRequestedAt !== null) {
      return NextResponse.json(
        { error: "Invoice has already been requested for this lead" },
        { status: 422 }
      )
    }

    const now = new Date()

    // Atomic: update lead + create stage history record
    const [updatedLead] = await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          stage: "invoiced",
          invoiceRequestedAt: now,
        },
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
          fromStage: "closed_won",
          toStage: "invoiced",
          changedBy: authUser.id,
        },
      }),
    ])

    // Sync client status — non-fatal if it fails
    try {
      await syncClientStatus(lead.clientId)
    } catch (syncErr) {
      console.error("[POST /api/leads/[id]/invoice] syncClientStatus failed", syncErr)
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
        invoiceRequestedAt: updatedLead.invoiceRequestedAt?.toISOString() ?? null,
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
    })
  } catch (err) {
    console.error("[POST /api/leads/[id]/invoice]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
