import { prisma } from "@/lib/prisma"

// ── Constants ────────────────────────────────────────────────────────────────

// Win-evidence: current stage proof that a deal was ever won.
// Used to distinguish "inactive" (past client) from "lead" (never converted).
const WIN_EVIDENCE_STAGES = ["closed_won", "invoiced", "contract_renewal"] as const
type WinEvidenceStage = (typeof WIN_EVIDENCE_STAGES)[number]

// ── computeClientStatus ──────────────────────────────────────────────────────
// Pure function — no DB access, easy to test.
//
// Rules:
//   active   = at least one lead in an active stage
//   inactive = no active lead, but has evidence of past winning engagement
//   lead     = no evidence of ever winning a deal
//
// Active determination by project type:
//   one_time  → stage = closed_won only (invoiced = done)
//   retainer  → stage in (closed_won | invoiced | contract_renewal)
//
// Note: contractEnd was removed from the Client model. Retainer active status
// is now determined purely by lead stage, using billingPlan recency as a proxy.

const RETAINER_ACTIVE_STAGES = ["closed_won", "invoiced", "contract_renewal"] as const
type RetainerActiveStage = (typeof RETAINER_ACTIVE_STAGES)[number]

const ONE_TIME_ACTIVE_STAGES = ["closed_won"] as const
type OneTimeActiveStage = (typeof ONE_TIME_ACTIVE_STAGES)[number]

// How many months after the last billing period before a retainer is considered ended.
const RETAINER_GRACE_MONTHS = 3

function parseBillingMonth(billingPlan: string | null): Date | null {
  if (!billingPlan) return null
  const parts = billingPlan.split("-")
  if (parts.length !== 2) return null
  const yy = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (isNaN(yy) || isNaN(mm) || mm < 1 || mm > 12) return null
  return new Date(2000 + yy, mm - 1, 1)
}

function monthsElapsed(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

function isRetainerLeadCurrentlyActive(
  lead: { stage: string; billingPlan: string | null },
  today: Date
): boolean {
  if (!RETAINER_ACTIVE_STAGES.includes(lead.stage as RetainerActiveStage)) return false

  // No contractEnd anymore — use billingPlan recency as proxy for whether the
  // retainer is still running. A lead with no billingPlan gets the benefit of
  // the doubt (can't determine age, so assume active).
  if (lead.billingPlan !== null) {
    const billingDate = parseBillingMonth(lead.billingPlan)
    if (billingDate !== null && monthsElapsed(billingDate, today) > RETAINER_GRACE_MONTHS) {
      return false
    }
  }

  return true
}

export function computeClientStatus(
  leads: Array<{ stage: string; projectType: string; billingPlan: string | null }>,
  today: Date = new Date()
): "active" | "inactive" | "lead" {
  const isActive = leads.some((l) => {
    if (l.projectType === "retainer") {
      return isRetainerLeadCurrentlyActive(l, today)
    }
    return ONE_TIME_ACTIVE_STAGES.includes(l.stage as OneTimeActiveStage)
  })

  if (isActive) return "active"
  if (leads.some((l) => WIN_EVIDENCE_STAGES.includes(l.stage as WinEvidenceStage))) {
    return "inactive"
  }
  return "lead"
}

// ── syncClientStatus ─────────────────────────────────────────────────────────
// Recomputes and persists clientStatus for a single client.
// Called after every stage-change operation.
// Errors are intentionally non-fatal — callers wrap in try/catch.

export async function syncClientStatus(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      leads: {
        where: { deletedAt: null },
        select: {
          stage: true,
          projectType: true,
          billingPlan: true,
        },
      },
    },
  })

  if (!client) return

  const status = computeClientStatus(client.leads)

  await prisma.client.update({
    where: { id: clientId },
    data: { clientStatus: status },
  })
}
