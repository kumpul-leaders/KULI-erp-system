import { describe, it, expect } from "vitest"
import {
  CreateCommentSchema,
  UpdateCommentSchema,
} from "@/lib/validations/comment"
import { extractMentionIds } from "@/lib/mention-parser"

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const VALID_UUID_2 = "6ba7b810-9dad-41d1-80b4-00c04fd430c8"

// ── CreateCommentSchema ──────────────────────────────────────────────────────

describe("CreateCommentSchema", () => {
  it("accepts a valid payload with leadId", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Great progress on this deal!",
      leadId: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it("accepts a valid payload with clientId only", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Client requested a call next week.",
      clientId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it("accepts payload with both leadId and clientId", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Cross-referenced with client account.",
      leadId: VALID_UUID,
      clientId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it("rejects when neither leadId nor clientId provided", () => {
    const result = CreateCommentSchema.safeParse({ body: "Some note." })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain(
        "At least one of leadId or clientId must be provided"
      )
    }
  })

  it("rejects empty body", () => {
    const result = CreateCommentSchema.safeParse({
      body: "",
      leadId: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("body is required")
    }
  })

  it("rejects body exceeding 5000 characters", () => {
    const result = CreateCommentSchema.safeParse({
      body: "x".repeat(5001),
      leadId: VALID_UUID,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("body must be at most 5000 characters")
    }
  })

  it("accepts body at exactly 5000 characters", () => {
    const result = CreateCommentSchema.safeParse({
      body: "a".repeat(5000),
      leadId: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid UUID for leadId", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Note here",
      leadId: "not-a-uuid",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("leadId must be a valid UUID")
    }
  })

  it("rejects invalid UUID for clientId", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Note here",
      clientId: "123",
    })
    expect(result.success).toBe(false)
  })

  it("does not accept mentions field from client (stripped silently)", () => {
    const result = CreateCommentSchema.safeParse({
      body: "Hi team",
      leadId: VALID_UUID,
      mentions: [VALID_UUID_2],
    })
    // Schema strips unknown keys — parse succeeds but mentions is not in output
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty("mentions")
    }
  })
})

// ── UpdateCommentSchema ──────────────────────────────────────────────────────

describe("UpdateCommentSchema", () => {
  it("accepts a valid body", () => {
    const result = UpdateCommentSchema.safeParse({ body: "Updated comment text." })
    expect(result.success).toBe(true)
  })

  it("rejects empty body", () => {
    const result = UpdateCommentSchema.safeParse({ body: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain("body is required")
    }
  })

  it("rejects body over 5000 characters", () => {
    const result = UpdateCommentSchema.safeParse({ body: "b".repeat(5001) })
    expect(result.success).toBe(false)
  })
})

// ── extractMentionIds (pure — no DB) ────────────────────────────────────────

describe("extractMentionIds", () => {
  it("extracts a single mention", () => {
    const ids = extractMentionIds(`Hey @[Alice](${VALID_UUID}) please review`)
    expect(ids).toEqual([VALID_UUID])
  })

  it("extracts multiple mentions", () => {
    const ids = extractMentionIds(
      `@[Alice](${VALID_UUID}) and @[Bob](${VALID_UUID_2}) please check`
    )
    expect(ids).toEqual([VALID_UUID, VALID_UUID_2])
  })

  it("returns empty array when no mentions", () => {
    const ids = extractMentionIds("Just a plain comment with no mentions.")
    expect(ids).toEqual([])
  })

  it("returns raw IDs including duplicates", () => {
    const ids = extractMentionIds(
      `@[Alice](${VALID_UUID}) and again @[Alice](${VALID_UUID})`
    )
    expect(ids).toEqual([VALID_UUID, VALID_UUID])
  })

  it("does not extract malformed mention without closing paren", () => {
    const ids = extractMentionIds(`@[Alice](${VALID_UUID}`)
    // Regex requires closing paren — should not match
    expect(ids).toEqual([])
  })

  it("handles mention at start of string", () => {
    const ids = extractMentionIds(`@[Bob](${VALID_UUID_2}) is assigned.`)
    expect(ids).toEqual([VALID_UUID_2])
  })

  it("handles mention embedded in markdown text", () => {
    const body = `**Update:** @[Alice](${VALID_UUID}) has reviewed. See _notes_ above.`
    const ids = extractMentionIds(body)
    expect(ids).toEqual([VALID_UUID])
  })
})
