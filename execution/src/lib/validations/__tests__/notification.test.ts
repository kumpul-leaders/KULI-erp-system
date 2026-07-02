import { describe, it, expect } from "vitest"
import {
  NotificationTypeSchema,
  CreateNotificationInputSchema,
  MarkReadSchema,
} from "@/lib/validations/notification"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_UUID_2 = "6ba7b810-9dad-41d1-80b4-00c04fd430c8"

// ── NotificationTypeSchema ────────────────────────────────────────────────────

describe("NotificationTypeSchema", () => {
  it("accepts all valid enum values", () => {
    const values = [
      "mention",
      "lead_assigned",
      "activity_due",
      "activity_overdue",
      "alert",
      "stage_change",
    ]
    for (const v of values) {
      expect(NotificationTypeSchema.safeParse(v).success).toBe(true)
    }
  })

  it("rejects unknown type", () => {
    expect(NotificationTypeSchema.safeParse("sms").success).toBe(false)
  })

  it("rejects empty string", () => {
    expect(NotificationTypeSchema.safeParse("").success).toBe(false)
  })
})

// ── CreateNotificationInputSchema ─────────────────────────────────────────────

describe("CreateNotificationInputSchema", () => {
  it("accepts minimal valid payload", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "mention",
      title: "William menyebut lu",
    })
    expect(result.success).toBe(true)
  })

  it("accepts full payload with optional fields", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "lead_assigned",
      title: "Lu di-assign lead Acme",
      body: "Lead baru telah di-assign ke kamu.",
      entityType: "lead",
      entityId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid userId (not UUID)", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: "not-a-uuid",
      type: "mention",
      title: "Test",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty title", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "mention",
      title: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects title exceeding 255 characters", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "mention",
      title: "x".repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid entityId (not UUID)", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "lead_assigned",
      title: "Test",
      entityId: "not-a-uuid",
    })
    expect(result.success).toBe(false)
  })

  it("accepts null for optional fields", () => {
    const result = CreateNotificationInputSchema.safeParse({
      userId: VALID_UUID,
      type: "alert",
      title: "System alert",
      body: null,
      entityType: null,
      entityId: null,
    })
    expect(result.success).toBe(true)
  })
})

// ── MarkReadSchema ────────────────────────────────────────────────────────────

describe("MarkReadSchema", () => {
  it("accepts { action: 'read' }", () => {
    expect(MarkReadSchema.safeParse({ action: "read" }).success).toBe(true)
  })

  it("rejects other action values", () => {
    expect(MarkReadSchema.safeParse({ action: "unread" }).success).toBe(false)
    expect(MarkReadSchema.safeParse({ action: "delete" }).success).toBe(false)
  })

  it("rejects empty object", () => {
    expect(MarkReadSchema.safeParse({}).success).toBe(false)
  })
})
