import { describe, it, expect } from "vitest"
import { CreateTargetSchema, UpdateTargetSchema } from "@/lib/validations/target"

describe("CreateTargetSchema — cross-field periodMonth validation", () => {
  it("accepts monthly type with periodMonth 1-12", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 7,
      revenueTarget: 50_000_000,
      type: "monthly",
    })
    expect(result.success).toBe(true)
  })

  it("accepts quarterly type with periodMonth 1-4", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 4,
      revenueTarget: 150_000_000,
      type: "quarterly",
    })
    expect(result.success).toBe(true)
  })

  it("rejects quarterly type when periodMonth is 5 (out of 1-4 range)", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 5, // invalid for quarterly
      revenueTarget: 150_000_000,
      type: "quarterly",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."))
      expect(paths).toContain("periodMonth")
    }
  })

  it("rejects monthly type when periodMonth is 13 (out of 1-12 range)", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 13,
      revenueTarget: 50_000_000,
      type: "monthly",
    })
    expect(result.success).toBe(false)
  })

  it("rejects periodMonth 0 for both types", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 0,
      revenueTarget: 50_000_000,
      type: "monthly",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative revenueTarget", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 1,
      revenueTarget: -1,
      type: "monthly",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid type enum", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 1,
      revenueTarget: 10_000_000,
      type: "annual", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("allows optional newClientTarget and salesId to be absent", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 6,
      revenueTarget: 75_000_000,
      type: "monthly",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.newClientTarget).toBeUndefined()
      expect(result.data.salesId).toBeUndefined()
    }
  })

  it("strips unknown keys", () => {
    const result = CreateTargetSchema.safeParse({
      periodYear: 2026,
      periodMonth: 3,
      revenueTarget: 50_000_000,
      type: "monthly",
      internalNote: "should be stripped",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("internalNote")
    }
  })
})

describe("UpdateTargetSchema", () => {
  it("accepts empty object (all optional for PATCH)", () => {
    expect(UpdateTargetSchema.safeParse({}).success).toBe(true)
  })

  it("rejects negative revenueTarget on update", () => {
    const result = UpdateTargetSchema.safeParse({ revenueTarget: -100 })
    expect(result.success).toBe(false)
  })
})
