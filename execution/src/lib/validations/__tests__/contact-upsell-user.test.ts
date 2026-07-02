import { describe, it, expect } from "vitest"
import { CreateContactSchema, UpdateContactSchema } from "@/lib/validations/contact"
import { CreateUpsellSchema, UpdateUpsellSchema } from "@/lib/validations/upsell"
import { CreateUserSchema, UpdateUserSchema } from "@/lib/validations/user"

// ── Contact ──────────────────────────────────────────────────────────────────

describe("CreateContactSchema", () => {
  it("accepts minimal valid payload (name only)", () => {
    const result = CreateContactSchema.safeParse({ name: "Budi Santoso" })
    expect(result.success).toBe(true)
  })

  it("rejects empty name", () => {
    const result = CreateContactSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects malformed email", () => {
    const result = CreateContactSchema.safeParse({
      name: "Budi",
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid email", () => {
    const result = CreateContactSchema.safeParse({
      name: "Budi",
      email: "budi@example.com",
    })
    expect(result.success).toBe(true)
  })

  it("allows email to be absent (optional)", () => {
    const result = CreateContactSchema.safeParse({ name: "Budi" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
    }
  })

  it("strips unknown keys", () => {
    const result = CreateContactSchema.safeParse({ name: "Budi", extra: "x" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("extra")
    }
  })
})

describe("UpdateContactSchema", () => {
  it("accepts empty object (all optional for PATCH)", () => {
    expect(UpdateContactSchema.safeParse({}).success).toBe(true)
  })

  it("rejects name as empty string on update", () => {
    const result = UpdateContactSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })
})

// ── Upsell ───────────────────────────────────────────────────────────────────

describe("CreateUpsellSchema", () => {
  it("accepts minimal valid payload (service only)", () => {
    const result = CreateUpsellSchema.safeParse({ service: "Video Production" })
    expect(result.success).toBe(true)
  })

  it("rejects empty service name", () => {
    const result = CreateUpsellSchema.safeParse({ service: "" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid status enum", () => {
    const result = CreateUpsellSchema.safeParse({
      service: "SEO",
      status: "pending", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("accepts all valid status enum values", () => {
    for (const status of ["identified", "pitched", "won", "lost"] as const) {
      const result = CreateUpsellSchema.safeParse({ service: "SEO", status })
      expect(result.success).toBe(true)
    }
  })

  it("allows optional fields to be absent", () => {
    const result = CreateUpsellSchema.safeParse({ service: "Video" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.estimatedValue).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
    }
  })
})

describe("UpdateUpsellSchema", () => {
  it("accepts empty object", () => {
    expect(UpdateUpsellSchema.safeParse({}).success).toBe(true)
  })
})

// ── User ─────────────────────────────────────────────────────────────────────

describe("CreateUserSchema", () => {
  it("accepts a valid user payload", () => {
    const result = CreateUserSchema.safeParse({
      name: "Andi Wijaya",
      email: "andi@vosfoyeragency.com",
      role: "account_manager",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid role enum", () => {
    const result = CreateUserSchema.safeParse({
      name: "Andi",
      email: "andi@test.com",
      role: "superadmin", // not in enum
    })
    expect(result.success).toBe(false)
  })

  it("rejects malformed email", () => {
    const result = CreateUserSchema.safeParse({
      name: "Andi",
      email: "not-valid",
      role: "admin",
    })
    expect(result.success).toBe(false)
  })

  it("allows isVp to be absent", () => {
    const result = CreateUserSchema.safeParse({
      name: "Andi",
      email: "andi@test.com",
      role: "admin",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isVp).toBeUndefined()
    }
  })

  it("strips unknown keys", () => {
    const result = CreateUserSchema.safeParse({
      name: "Andi",
      email: "andi@test.com",
      role: "hr",
      internal_id: "should-be-stripped",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("internal_id")
    }
  })
})

describe("UpdateUserSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(true)
  })

  it("accepts isActive boolean", () => {
    const result = UpdateUserSchema.safeParse({ isActive: false })
    expect(result.success).toBe(true)
  })
})
