import { z } from "zod"

// ── Enum ─────────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum([
  "admin",
  "commercial_director",
  "account_manager",
  "account",
  "operation",
  "hr",
  "finance",
])

const EmailSchema = z
  .string()
  .min(1, "Valid email is required")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email is required")

// ── POST /api/users ──────────────────────────────────────────────────────────
// Required: name, email, role
// Optional: division, isVp

export const CreateUserSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: EmailSchema,
  role: RoleSchema,
  division: z.string().optional().nullable(),
  isVp: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>

// ── PATCH /api/users/[id] ────────────────────────────────────────────────────
// All fields optional — partial update.

export const UpdateUserSchema = z.object({
  name: z.string().min(1, "name must be a non-empty string").optional(),
  email: EmailSchema.optional(),
  role: RoleSchema.optional(),
  division: z.string().optional().nullable(),
  isVp: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
