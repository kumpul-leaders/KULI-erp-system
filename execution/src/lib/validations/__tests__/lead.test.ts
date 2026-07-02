import { describe, it, expect } from "vitest"
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  StageTransitionSchema,
  BulkCreateLeadSchema,
  BulkReassignSchema,
} from "@/lib/validations/lead"

describe("CreateLeadSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "smm",
      projectType: "retainer",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid productLine enum value", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "digital_pr", // not in enum
      projectType: "retainer",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid projectType enum value", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "smm",
      projectType: "milestone", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("rejects billingPlan with wrong format", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "smm",
      projectType: "retainer",
      billingPlan: "2026-08", // wrong — must be YY-MM not YYYY-MM
    })
    expect(result.success).toBe(false)
  })

  it("accepts billingPlan in correct YY-MM format", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "media_buying",
      projectType: "one_time",
      billingPlan: "26-08",
    })
    expect(result.success).toBe(true)
  })

  it("strips unknown keys", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "ads_management",
      projectType: "one_time",
      rogue: "value",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("rogue")
    }
  })
})

describe("UpdateLeadSchema", () => {
  it("accepts empty object (all optional for PATCH)", () => {
    expect(UpdateLeadSchema.safeParse({}).success).toBe(true)
  })

  it("accepts projectedRevenue as null (explicit clear)", () => {
    const result = UpdateLeadSchema.safeParse({ projectedRevenue: null })
    expect(result.success).toBe(true)
  })
})

describe("StageTransitionSchema", () => {
  it("accepts valid toStage", () => {
    const result = StageTransitionSchema.safeParse({ toStage: "closed_won" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid toStage enum value", () => {
    const result = StageTransitionSchema.safeParse({ toStage: "won" }) // not in enum
    expect(result.success).toBe(false)
  })

  it("accepts lossDealReason as optional", () => {
    const result = StageTransitionSchema.safeParse({
      toStage: "lost_deal",
      lossDealReason: "Budget constraints",
    })
    expect(result.success).toBe(true)
  })
})

describe("BulkCreateLeadSchema", () => {
  it("accepts valid bulk payload with 3 billing plans", () => {
    const result = BulkCreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "production",
      projectType: "retainer",
      billingPlans: ["26-01", "26-02", "26-03"],
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty billingPlans array", () => {
    const result = BulkCreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "production",
      projectType: "retainer",
      billingPlans: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("BulkReassignSchema", () => {
  it("accepts valid fromUserId and toUserId", () => {
    const result = BulkReassignSchema.safeParse({
      fromUserId: "user-a",
      toUserId: "user-b",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty fromUserId", () => {
    const result = BulkReassignSchema.safeParse({
      fromUserId: "",
      toUserId: "user-b",
    })
    expect(result.success).toBe(false)
  })
})
