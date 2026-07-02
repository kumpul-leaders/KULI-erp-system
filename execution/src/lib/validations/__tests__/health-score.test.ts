import { describe, it, expect } from "vitest"
import {
  computeSignalActivity,
  computeSignalRenewal,
  computeSignalRevenue,
  computeSignalEngagement,
  computeHealthSignals,
  computeBand,
  isoWeek,
  shouldApplyHealthUpdate,
} from "@/lib/health-score"

// ── computeSignalActivity ─────────────────────────────────────────────────────

describe("computeSignalActivity", () => {
  it("returns 100 when last activity was < 7 days ago", () => {
    expect(computeSignalActivity(3)).toBe(100)
  })

  it("returns 100 at exactly 6 days", () => {
    expect(computeSignalActivity(6)).toBe(100)
  })

  it("returns 75 at 7 days", () => {
    expect(computeSignalActivity(7)).toBe(75)
  })

  it("returns 75 between 7 and 13 days", () => {
    expect(computeSignalActivity(13)).toBe(75)
  })

  it("returns 50 at 14 days", () => {
    expect(computeSignalActivity(14)).toBe(50)
  })

  it("returns 25 at 30 days", () => {
    expect(computeSignalActivity(30)).toBe(25)
  })

  it("returns 0 at 60 days", () => {
    expect(computeSignalActivity(60)).toBe(0)
  })

  it("returns 0 when null (never touched)", () => {
    expect(computeSignalActivity(null)).toBe(0)
  })
})

// ── computeSignalRenewal ──────────────────────────────────────────────────────

describe("computeSignalRenewal", () => {
  it("returns 50 when no contract (null)", () => {
    expect(computeSignalRenewal(null)).toBe(50)
  })

  it("returns 100 when > 180 days remaining", () => {
    expect(computeSignalRenewal(181)).toBe(100)
  })

  it("returns 75 at 91 days", () => {
    expect(computeSignalRenewal(91)).toBe(75)
  })

  it("returns 50 at 61 days", () => {
    expect(computeSignalRenewal(61)).toBe(50)
  })

  it("returns 25 at 31 days", () => {
    expect(computeSignalRenewal(31)).toBe(25)
  })

  it("returns 0 at exactly 30 days", () => {
    expect(computeSignalRenewal(30)).toBe(0)
  })

  it("returns 0 when already expired (negative)", () => {
    expect(computeSignalRenewal(-5)).toBe(0)
  })
})

// ── computeSignalRevenue ──────────────────────────────────────────────────────

describe("computeSignalRevenue", () => {
  it("returns 100 for recent won lead, no upsell", () => {
    expect(computeSignalRevenue(true, false, false)).toBe(100)
  })

  it("returns 60 for open pipeline only", () => {
    expect(computeSignalRevenue(false, true, false)).toBe(60)
  })

  it("returns 20 when nothing", () => {
    expect(computeSignalRevenue(false, false, false)).toBe(20)
  })

  it("caps at 100 even with upsell on top of won lead", () => {
    expect(computeSignalRevenue(true, false, true)).toBe(100)
  })

  it("adds 20 for upsell on open pipeline (60+20=80)", () => {
    expect(computeSignalRevenue(false, true, true)).toBe(80)
  })

  it("adds 20 for upsell to baseline 20 = 40", () => {
    expect(computeSignalRevenue(false, false, true)).toBe(40)
  })
})

// ── computeSignalEngagement ───────────────────────────────────────────────────

describe("computeSignalEngagement", () => {
  it("returns 100 when open activity and no alert", () => {
    expect(computeSignalEngagement(true, false)).toBe(100)
  })

  it("returns 30 when no open activity and no alert", () => {
    expect(computeSignalEngagement(false, false)).toBe(30)
  })

  it("returns 0 when unacknowledged alert exists (regardless of open activity)", () => {
    expect(computeSignalEngagement(true, true)).toBe(0)
    expect(computeSignalEngagement(false, true)).toBe(0)
  })
})

// ── computeBand ───────────────────────────────────────────────────────────────

describe("computeBand", () => {
  it("returns healthy at 75", () => {
    expect(computeBand(75)).toBe("healthy")
  })

  it("returns healthy at 100", () => {
    expect(computeBand(100)).toBe("healthy")
  })

  it("returns at_risk at 74", () => {
    expect(computeBand(74)).toBe("at_risk")
  })

  it("returns at_risk at 40", () => {
    expect(computeBand(40)).toBe("at_risk")
  })

  it("returns at_risk at 0 (churned-risk — never auto-set churned)", () => {
    expect(computeBand(0)).toBe("at_risk")
  })
})

// ── computeHealthSignals composite ───────────────────────────────────────────

describe("computeHealthSignals", () => {
  it("returns healthy band for a well-engaged client", () => {
    const result = computeHealthSignals({
      lastActivityDaysAgo: 3,
      contractDaysRemaining: 200,
      hasRecentWonLead: true,
      hasOpenPipeline: true,
      hasRecentUpsellWon: false,
      hasOpenActivity: true,
      hasUnacknowledgedAlert: false,
    })
    expect(result.band).toBe("healthy")
    expect(result.score).toBeGreaterThanOrEqual(75)
    expect(result.signalActivity).toBe(100)
    expect(result.signalRenewal).toBe(100)
  })

  it("returns at_risk for a stale client", () => {
    const result = computeHealthSignals({
      lastActivityDaysAgo: 90,
      contractDaysRemaining: 20,
      hasRecentWonLead: false,
      hasOpenPipeline: false,
      hasRecentUpsellWon: false,
      hasOpenActivity: false,
      hasUnacknowledgedAlert: false,
    })
    expect(result.band).toBe("at_risk")
    expect(result.signalActivity).toBe(0)
    expect(result.signalRenewal).toBe(0)
    expect(result.signalRevenue).toBe(20)
  })

  it("unacknowledged alert forces engagement to 0", () => {
    const result = computeHealthSignals({
      lastActivityDaysAgo: 1,
      contractDaysRemaining: 300,
      hasRecentWonLead: true,
      hasOpenPipeline: true,
      hasRecentUpsellWon: true,
      hasOpenActivity: true,
      hasUnacknowledgedAlert: true,
    })
    expect(result.signalEngagement).toBe(0)
  })
})

// ── isoWeek ───────────────────────────────────────────────────────────────────

describe("isoWeek", () => {
  it("returns correct ISO week string for a known date", () => {
    // 2026-01-05 is a Monday in week 2 of 2026
    expect(isoWeek(new Date(2026, 0, 5))).toBe("2026-W02")
  })

  it("returns W01 for the first week of 2026", () => {
    // 2025-12-29 is in ISO week 1 of 2026
    expect(isoWeek(new Date(2025, 11, 29))).toBe("2026-W01")
  })

  it("returns format YYYY-WNN", () => {
    const result = isoWeek(new Date(2026, 6, 3)) // 2026-07-03
    expect(result).toMatch(/^\d{4}-W\d{2}$/)
  })
})

// ── shouldApplyHealthUpdate (cold-start guard) ────────────────────────────────

describe("shouldApplyHealthUpdate", () => {
  it("returns true when engagement data exists", () => {
    expect(shouldApplyHealthUpdate(true)).toBe(true)
  })

  it("returns false when no engagement data — cold-start state", () => {
    expect(shouldApplyHealthUpdate(false)).toBe(false)
  })
})

// ── Cold-start scenario: computeHealthSignals with null activity ───────────────
// Validates that a client with no activity/comment history scores at_risk
// (signalActivity=0), which is exactly why the cold-start guard is needed.

describe("cold-start scenario", () => {
  it("client with no activity at all scores at_risk with signalActivity=0", () => {
    const result = computeHealthSignals({
      lastActivityDaysAgo: null,     // no activity or comment ever
      contractDaysRemaining: 365,    // contract fine
      hasRecentWonLead: true,        // strong revenue signal
      hasOpenPipeline: true,
      hasRecentUpsellWon: false,
      hasOpenActivity: false,
      hasUnacknowledgedAlert: false,
    })
    expect(result.signalActivity).toBe(0)
    // score = 0*0.35 + 100*0.30 + 100*0.20 + 30*0.15 = 0 + 30 + 20 + 4.5 = 54.5 → 55
    // band at_risk because 55 < 75
    expect(result.band).toBe("at_risk")
    // shouldApplyHealthUpdate(false) must be called before acting on this score
    expect(shouldApplyHealthUpdate(false)).toBe(false)
  })

  it("same client with one recent activity scores healthy — guard allows apply", () => {
    const result = computeHealthSignals({
      lastActivityDaysAgo: 3,        // active this week
      contractDaysRemaining: 365,
      hasRecentWonLead: true,
      hasOpenPipeline: true,
      hasRecentUpsellWon: false,
      hasOpenActivity: true,
      hasUnacknowledgedAlert: false,
    })
    expect(result.signalActivity).toBe(100)
    expect(result.band).toBe("healthy")
    expect(shouldApplyHealthUpdate(true)).toBe(true)
  })
})
