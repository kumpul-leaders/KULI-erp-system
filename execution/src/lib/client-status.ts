import { prisma } from "@/lib/prisma"

// ── Constants ────────────────────────────────────────────────────────────────

// Retainer: invoiced = recurring monthly billing, project still running.
// One-time: invoiced = project done and billed, engagement is over.
const RETAINER_ACTIVE_STAGES = ["closed_won", "invoiced", "contract_renewal"] as const
const ONE_TIME_ACTIVE_STAGES = ["closed_won"] as const

type RetainerActiveStage = (typeof RETAINER_ACTIVE_STAGES)[number]
type OneTimeActiveStage = (typeof ONE_TIME_ACTIVE_STAGES)[number]

// Win-evidence: current stage proof that a deal was ever won.
// Used to distinguish "inactive" (past client) from "lead" (never converted).
// stageHistory records are not populated from import, so we use current stage.
const WIN_EVIDENCE_STAGES = ["closed_won", "invoiced", "contract_renewal"] as const
type WinEvidenceStage = (typeof WIN_EVIDENCE_STAGES)[number]

// How many months after the last billing period before a retainer is considered ended.
// Applied when contractEnd is not set on the client.
const RETAINER_GRACE_MONTHS = 3

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  contractEnd: Date | null,
  today: Date
): boolean {
  if (!RETAINER_ACTIVE_STAGES.includes(lead.stage as RetainerActiveStage)) return false

  // Contract explicitly ended — retainer is over regardless of lead stage
  if (contractEnd !== null && contractEnd < today) return false

  // No contractEnd set: use billingPlan recency as a proxy for whether the
  // retainer is still running. A lead with no billingPlan gets the benefit of
  // the doubt (can't determine age, so assume active).
  if (contractEnd === null && lead.billingPlan !== null) {
    const billingDate = parseBillingMonth(lead.billingPlan)
    if (billingDate !== null && monthsElapsed(billingDate, today) > RETAINER_GRACE_MONTHS) {
      return false
    }
  }

  return true
}

// ── computeClientStatus ──────────────────────────────────────────────────────
// Pure function — no DB access, easy to test.
//
// Rules:
//   active   = at least one lead currently active (per project type + time checks)
//   inactive = no active lead, but has evidence of past winning engagement
//   lead     = no evidence of ever winning a deal
//
// Active determination by project type:
//   one_time  → stage = closed_won only (invoiced = done)
//   retainer  → stage in (closed_won | invoiced | contract_renewal)
//               AND contractEnd >= today (if set)
//               AND billingPlan within last 3 months (if contractEnd not set)

export function computeClientStatus(
  leads: Array<{ stage: string; projectType: string; billingPlan: string | null }>,
  contractEnd: Date | null,
  today: Date = new Date()
): "active" | "inactive" | "lead" {
  const isActive = leads.some((l) => {
    if (l.projectType === "retainer") {
      return isRetainerLeadCurrentlyActive(l, contractEnd, today)
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
      contractEnd: true,
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

  const status = computeClientStatus(client.leads, client.contractEnd)

  await prisma.client.update({
    where: { id: clientId },
    data: { clientStatus: status },
  })
}
