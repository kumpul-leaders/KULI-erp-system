import { describe, it, expect } from "vitest"
import { CreateClientSchema, UpdateClientSchema } from "@/lib/validations/client"

describe("CreateClientSchema", () => {
  it("accepts a minimal valid payload (name + engagementType only)", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Maju Bersama",
      engagementType: "retainer",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a full valid payload with all optional fields", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Maju Bersama",
      engagementType: "project",
      industry: "Tech",
      orgSize: "50-200",
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      monthlyValue: 15_000_000,
      annualValue: 180_000_000,
      healthStatus: "healthy",
      clientStatus: "active",
      primaryAe: "user-uuid-123",
      customerCode: "VF-001",
      notes: "Key account",
    })
    expect(result.success).toBe(true)
  })

  it("rejects when name is missing", () => {
    const result = CreateClientSchema.safeParse({ engagementType: "retainer" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid engagementType enum value", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Test",
      engagementType: "subscription", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid healthStatus enum value", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Test",
      engagementType: "both",
      healthStatus: "excellent", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("strips unknown keys (Zod default strip mode)", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Test",
      engagementType: "both",
      unknownField: "should be stripped",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("unknownField")
    }
  })

  it("allows optional fields to be absent", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Minimal",
      engagementType: "project",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
    }
  })
})

describe("UpdateClientSchema", () => {
  it("accepts an empty object (all fields optional in PATCH)", () => {
    const result = UpdateClientSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("rejects name as empty string", () => {
    const result = UpdateClientSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  it("accepts clientStatus null (explicit clear)", () => {
    const result = UpdateClientSchema.safeParse({ clientStatus: null })
    expect(result.success).toBe(true)
  })
})
