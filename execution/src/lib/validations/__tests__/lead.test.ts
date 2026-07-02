import { describe, it, expect } from "vitest"
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  StageTransitionSchema,
  BulkCreateLeadSchema,
  BulkReassignSchema,
  LostReasonSchema,
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

describe("LostReasonSchema", () => {
  it("accepts all valid LostReason values", () => {
    const values = ["budget", "competitor", "timing", "no_decision", "requirements_mismatch", "other"]
    for (const v of values) {
      expect(LostReasonSchema.safeParse(v).success).toBe(true)
    }
  })

  it("rejects invalid LostReason value", () => {
    expect(LostReasonSchema.safeParse("price_too_high").success).toBe(false)
  })
})

describe("UpdateLeadSchema — probability fields", () => {
  it("accepts probability as number 0-100", () => {
    expect(UpdateLeadSchema.safeParse({ probability: 75 }).success).toBe(true)
    expect(UpdateLeadSchema.safeParse({ probability: 0 }).success).toBe(true)
    expect(UpdateLeadSchema.safeParse({ probability: 100 }).success).toBe(true)
  })

  it("rejects probability above 100", () => {
    expect(UpdateLeadSchema.safeParse({ probability: 101 }).success).toBe(false)
  })

  it("rejects probability below 0", () => {
    expect(UpdateLeadSchema.safeParse({ probability: -1 }).success).toBe(false)
  })

  it("accepts probabilityIsManual as boolean", () => {
    expect(UpdateLeadSchema.safeParse({ probabilityIsManual: true }).success).toBe(true)
    expect(UpdateLeadSchema.safeParse({ probabilityIsManual: false }).success).toBe(true)
  })

  it("accepts lostReason as valid enum value", () => {
    expect(UpdateLeadSchema.safeParse({ lostReason: "budget" }).success).toBe(true)
    expect(UpdateLeadSchema.safeParse({ lostReason: "competitor" }).success).toBe(true)
  })

  it("rejects lostReason with invalid value", () => {
    expect(UpdateLeadSchema.safeParse({ lostReason: "too_expensive" }).success).toBe(false)
  })

  it("accepts lostReason as null (explicit clear)", () => {
    expect(UpdateLeadSchema.safeParse({ lostReason: null }).success).toBe(true)
  })

  it("strips unknown keys alongside new probability fields", () => {
    const result = UpdateLeadSchema.safeParse({ probability: 50, rogue: "xyz" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("rogue")
      expect(result.data.probability).toBe(50)
    }
  })
})

describe("CreateLeadSchema — lostReason field", () => {
  it("accepts lostReason as optional", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "smm",
      projectType: "retainer",
      lostReason: "timing",
    })
    expect(result.success).toBe(true)
  })

  it("accepts without lostReason (backwards compatible)", () => {
    const result = CreateLeadSchema.safeParse({
      clientId: "client-uuid-001",
      productLine: "smm",
      projectType: "retainer",
    })
    expect(result.success).toBe(true)
  })
})
