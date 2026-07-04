import { describe, it, expect } from "vitest"
import { CreateClientSchema, UpdateClientSchema } from "@/lib/validations/client"

describe("CreateClientSchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Maju Bersama",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a full valid payload with all optional fields", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Maju Bersama",
      engagementType: "project",
      industry: "Tech",
      orgSize: "50-200",
      officeAddress: "Jl. Sudirman No. 1, Jakarta",
      healthStatus: "healthy",
      clientStatus: "active",
      primaryAe: "user-uuid-123",
      customerCode: "VF-001",
      notes: "Key account",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a payload with initialContact", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Baru",
      officeAddress: "Jl. Thamrin 10",
      initialContact: {
        name: "Budi Santoso",
        role: "CEO",
        email: "budi@ptnew.com",
        phone: "081234567890",
      },
    })
    expect(result.success).toBe(true)
  })

  it("rejects initialContact with invalid email", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Baru",
      initialContact: {
        name: "Budi",
        role: "CEO",
        email: "not-an-email",
      },
    })
    expect(result.success).toBe(false)
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
      healthStatus: "excellent", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("strips unknown keys (Zod default strip mode)", () => {
    const result = CreateClientSchema.safeParse({
      name: "PT Test",
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
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.industry).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
      expect(result.data.officeAddress).toBeUndefined()
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

  it("accepts officeAddress update", () => {
    const result = UpdateClientSchema.safeParse({
      officeAddress: "Jl. Gatot Subroto No. 5",
    })
    expect(result.success).toBe(true)
  })
})
