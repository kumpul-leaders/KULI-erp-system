import { describe, it, expect } from "vitest"
import {
  CreateActivitySchema,
  UpdateActivitySchema,
  ActionSchema,
  ActivityTypeSchema,
  ActivityStatusSchema,
} from "@/lib/validations/activity"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_UUID_2 = "6ba7b810-9dad-41d1-80b4-00c04fd430c8"

// ── CreateActivitySchema ─────────────────────────────────────────────────────

describe("CreateActivitySchema", () => {
  it("accepts a valid payload with leadId", () => {
    const result = CreateActivitySchema.safeParse({
      type: "call",
      subject: "Follow-up call",
      dueDate: "2026-07-10",
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid payload with clientId only", () => {
    const result = CreateActivitySchema.safeParse({
      type: "email",
      subject: "Send proposal",
      dueDate: "2026-08-01",
      assignedTo: VALID_UUID,
      clientId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it("accepts payload with both leadId and clientId", () => {
    const result = CreateActivitySchema.safeParse({
      type: "meeting",
      subject: "Kickoff meeting",
      dueDate: "2026-07-15",
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
      clientId: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it("rejects when both leadId and clientId are absent", () => {
    const result = CreateActivitySchema.safeParse({
      type: "todo",
      subject: "Prepare deck",
      dueDate: "2026-07-20",
      assignedTo: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain(
        "At least one of leadId or clientId must be provided"
      )
    }
  })

  it("rejects invalid ActivityType enum", () => {
    const result = CreateActivitySchema.safeParse({
      type: "phone_call", // not in enum
      subject: "Test",
      dueDate: "2026-07-10",
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })

  it("rejects subject longer than 200 characters", () => {
    const result = CreateActivitySchema.safeParse({
      type: "call",
      subject: "x".repeat(201),
      dueDate: "2026-07-10",
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })

  it("rejects dueDate with wrong format", () => {
    const result = CreateActivitySchema.safeParse({
      type: "call",
      subject: "Follow up",
      dueDate: "10-07-2026", // wrong format
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })

  it("strips unknown keys", () => {
    const result = CreateActivitySchema.safeParse({
      type: "todo",
      subject: "Task",
      dueDate: "2026-07-10",
      assignedTo: VALID_UUID,
      leadId: VALID_UUID_2,
      rogue: "should be stripped",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("rogue")
    }
  })
})

// ── UpdateActivitySchema ─────────────────────────────────────────────────────

describe("UpdateActivitySchema", () => {
  it("accepts empty object (all optional for PATCH)", () => {
    expect(UpdateActivitySchema.safeParse({}).success).toBe(true)
  })

  it("accepts dueDate reschedule only", () => {
    const result = UpdateActivitySchema.safeParse({ dueDate: "2026-09-01" })
    expect(result.success).toBe(true)
  })

  it("accepts assignedTo reassign only", () => {
    const result = UpdateActivitySchema.safeParse({ assignedTo: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it("rejects invalid dueDate format", () => {
    const result = UpdateActivitySchema.safeParse({ dueDate: "July 10 2026" })
    expect(result.success).toBe(false)
  })
})

// ── ActionSchema ─────────────────────────────────────────────────────────────

describe("ActionSchema", () => {
  it("accepts action: done", () => {
    expect(ActionSchema.safeParse({ action: "done" }).success).toBe(true)
  })

  it("accepts action: cancel", () => {
    expect(ActionSchema.safeParse({ action: "cancel" }).success).toBe(true)
  })

  it("accepts action: reopen", () => {
    expect(ActionSchema.safeParse({ action: "reopen" }).success).toBe(true)
  })

  it("rejects invalid action value", () => {
    expect(ActionSchema.safeParse({ action: "archive" }).success).toBe(false)
  })
})

// ── Enum schemas ─────────────────────────────────────────────────────────────

describe("ActivityTypeSchema", () => {
  it("accepts all valid ActivityType values", () => {
    const values = ["call", "email", "meeting", "todo", "deadline"]
    for (const v of values) {
      expect(ActivityTypeSchema.safeParse(v).success).toBe(true)
    }
  })

  it("rejects invalid ActivityType", () => {
    expect(ActivityTypeSchema.safeParse("sms").success).toBe(false)
  })
})

describe("ActivityStatusSchema", () => {
  it("accepts all valid ActivityStatus values", () => {
    const values = ["open", "done", "canceled"]
    for (const v of values) {
      expect(ActivityStatusSchema.safeParse(v).success).toBe(true)
    }
  })

  it("rejects invalid ActivityStatus", () => {
    expect(ActivityStatusSchema.safeParse("pending").success).toBe(false)
  })
})
