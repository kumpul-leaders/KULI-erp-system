import { prisma } from "@/lib/prisma"

// ── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_STAGES = ["closed_won", "invoiced", "contract_renewal"] as const
type ActiveStage = (typeof ACTIVE_STAGES)[number]

// ── computeClientStatus ──────────────────────────────────────────────────────
// Pure function — no DB access, easy to test.
//
// Rules:
//   active   = at least one lead currently in an active stage
//   inactive = no active lead now, but has stage history showing a win (ever)
//   lead     = no evidence of ever winning a deal

// NOTE: `stageHistory` in each lead must be pre-filtered to only entries where
// toStage IN ACTIVE_STAGES (with take: 1). The `l.stageHistory.length > 0` check
// in the inactive branch relies on this — do not change the Prisma query filter
// without updating this function accordingly.
function computeClientStatus(
  leads: Array<{
    stage: string
    stageHistory: { id: string }[]
  }>
): "active" | "inactive" | "lead" {
  if (leads.some((l) => ACTIVE_STAGES.includes(l.stage as ActiveStage))) {
    return "active"
  }
  if (leads.some((l) => l.stageHistory.length > 0)) {
    return "inactive"
  }
  return "lead"
}

// ── syncClientStatus ─────────────────────────────────────────────────────────
// Recomputes and persists clientStatus for a single client.
// Called after every stage-change operation.
// Errors are intentionally non-fatal — callers wrap in try/catch.

export async function syncClientStatus(clientId: string): Promise<void> {
  const leads = await prisma.lead.findMany({
    where: { clientId },
    select: {
      stage: true,
      stageHistory: {
        where: {
          toStage: { in: ["closed_won", "invoiced", "contract_renewal"] },
        },
        select: { id: true },
        take: 1,
      },
    },
  })

  const status = computeClientStatus(leads)

  await prisma.client.update({
    where: { id: clientId },
    data: { clientStatus: status },
  })
}
