/**
 * Health Score — Pure computation functions (no DB calls).
 *
 * Formula version: v1.0 (2026-07-03)
 * Weights: Activity 35%, Renewal 30%, Revenue 20%, Engagement 15%
 *
 * Keep these functions pure so they can be unit-tested without a database.
 * DB wiring lives in /api/cron/health.
 */

import type { HealthStatus } from "@prisma/client"

// ── Input types ───────────────────────────────────────────────────────────────

export interface HealthSignalInput {
  /** Days since the most recent Activity or Comment on the client or its leads. null = never. */
  lastActivityDaysAgo: number | null
  /** Days until contractEnd. null = no contract set. negative = already expired. */
  contractDaysRemaining: number | null
  /** Whether there is at least one won lead in the last 6 months. */
  hasRecentWonLead: boolean
  /** Whether there is at least one open lead in pipeline (not lost/invoiced). */
  hasOpenPipeline: boolean
  /** Whether there is at least one upsell won in the last 6 months. */
  hasRecentUpsellWon: boolean
  /** Whether there is at least one open Activity on this client. */
  hasOpenActivity: boolean
  /** Whether there is at least one open Alert that is unacknowledged. */
  hasUnacknowledgedAlert: boolean
}

export interface HealthSignalResult {
  signalActivity: number    // 0-100
  signalRenewal: number     // 0-100
  signalRevenue: number     // 0-100
  signalEngagement: number  // 0-100
  score: number             // 0-100 composite
  band: HealthStatus        // healthy | at_risk | churned-risk → stored as at_risk
}

// ── Signal: Activity recency (35%) ────────────────────────────────────────────
// Scores how recently the client was touched (activity/comment on client or leads)

export function computeSignalActivity(lastActivityDaysAgo: number | null): number {
  if (lastActivityDaysAgo === null) return 0
  if (lastActivityDaysAgo < 7) return 100
  if (lastActivityDaysAgo < 14) return 75
  if (lastActivityDaysAgo < 30) return 50
  if (lastActivityDaysAgo < 60) return 25
  return 0
}

// ── Signal: Renewal proximity (30%) ──────────────────────────────────────────
// Scores based on how far the contractEnd is in the future.
// No contract = neutral 50.

export function computeSignalRenewal(contractDaysRemaining: number | null): number {
  if (contractDaysRemaining === null) return 50 // neutral — no contract
  if (contractDaysRemaining > 180) return 100
  if (contractDaysRemaining > 90) return 75
  if (contractDaysRemaining > 60) return 50
  if (contractDaysRemaining > 30) return 25
  return 0 // expired or ≤30 days
}

// ── Signal: Revenue (20%) ─────────────────────────────────────────────────────
// Scores based on revenue history and open pipeline.

export function computeSignalRevenue(
  hasRecentWonLead: boolean,
  hasOpenPipeline: boolean,
  hasRecentUpsellWon: boolean
): number {
  let score: number
  if (hasRecentWonLead) {
    score = 100
  } else if (hasOpenPipeline) {
    score = 60
  } else {
    score = 20
  }
  // Upsell won in last 6 months adds +20, capped at 100
  if (hasRecentUpsellWon) {
    score = Math.min(100, score + 20)
  }
  return score
}

// ── Signal: Engagement (15%) ─────────────────────────────────────────────────
// Scores based on open activities and unacknowledged alerts.

export function computeSignalEngagement(
  hasOpenActivity: boolean,
  hasUnacknowledgedAlert: boolean
): number {
  // Unacknowledged alert → drops to 0 regardless
  if (hasUnacknowledgedAlert) return 0
  return hasOpenActivity ? 100 : 30
}

// ── Composite score + band ────────────────────────────────────────────────────

export function computeHealthSignals(input: HealthSignalInput): HealthSignalResult {
  const signalActivity = computeSignalActivity(input.lastActivityDaysAgo)
  const signalRenewal = computeSignalRenewal(input.contractDaysRemaining)
  const signalRevenue = computeSignalRevenue(
    input.hasRecentWonLead,
    input.hasOpenPipeline,
    input.hasRecentUpsellWon
  )
  const signalEngagement = computeSignalEngagement(
    input.hasOpenActivity,
    input.hasUnacknowledgedAlert
  )

  // Weighted composite: Activity 35%, Renewal 30%, Revenue 20%, Engagement 15%
  const score = Math.round(
    signalActivity * 0.35 +
    signalRenewal * 0.30 +
    signalRevenue * 0.20 +
    signalEngagement * 0.15
  )

  const band = computeBand(score)

  return { signalActivity, signalRenewal, signalRevenue, signalEngagement, score, band }
}

// ── Band classification ───────────────────────────────────────────────────────
// ≥75 → healthy, 40–74 → at_risk, <40 → at_risk (churned-risk)
// NOTE: we NEVER auto-set "churned" — that remains a manual decision.
// Sub-40 is still stored as at_risk in the DB so the UI can show it differently
// based on score value if needed.

export function computeBand(score: number): HealthStatus {
  if (score >= 75) return "healthy"
  return "at_risk"
}

// ── Cold-start guard ─────────────────────────────────────────────────────────
// Returns true when it is safe to apply healthStatus updates and create
// health_drop alerts for a client.
//
// Prevents a cold-start artifact: on the first cron run, every client has
// lastActivityDaysAgo=null → signalActivity=0 → all score <75 → all flip to
// at_risk → spam alerts. "Engagement data exists" = ≥1 Activity or Comment
// recorded for this client (any date). Snapshots always save; this gate only
// controls healthStatus writes and alert creation.

export function shouldApplyHealthUpdate(hasEngagementData: boolean): boolean {
  return hasEngagementData
}

// ── ISO week helper ───────────────────────────────────────────────────────────
// Returns "YYYY-WNN" format for the given date (ISO week number).

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}
