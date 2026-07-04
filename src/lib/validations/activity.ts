import { z } from "zod"

// ── Enum literals ────────────────────────────────────────────────────────────

export const ActivityTypeSchema = z.enum([
  "call",
  "email",
  "meeting",
  "todo",
  "deadline",
])

export const ActivityStatusSchema = z.enum(["open", "done", "canceled"])

export const ActivityActionSchema = z.enum(["done", "cancel", "reopen"])

// ── POST /api/activities ─────────────────────────────────────────────────────
// Required: type, subject, dueDate, assignedTo
// At least one of leadId / clientId must be provided — enforced via superRefine.
// Optional: note, leadId, clientId

export const CreateActivitySchema = z
  .object({
    type: ActivityTypeSchema,
    subject: z
      .string()
      .min(1, "subject is required")
      .max(200, "subject must be at most 200 characters"),
    note: z.string().optional().nullable(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be an ISO date string (YYYY-MM-DD)"),
    leadId: z.string().uuid("leadId must be a valid UUID").optional().nullable(),
    clientId: z
      .string()
      .uuid("clientId must be a valid UUID")
      .optional()
      .nullable(),
    assignedTo: z.string().uuid("assignedTo must be a valid UUID"),
  })
  .superRefine((data, ctx) => {
    if (!data.leadId && !data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of leadId or clientId must be provided",
        path: ["leadId"],
      })
    }
  })

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>

// ── PATCH /api/activities/[id] — field update ────────────────────────────────
// All fields optional. Used for reschedule (dueDate), edit (subject/note/type/assignedTo).
// action field is handled by ActionSchema below — not mixed in here.

export const UpdateActivitySchema = z.object({
  type: ActivityTypeSchema.optional(),
  subject: z
    .string()
    .min(1, "subject is required")
    .max(200, "subject must be at most 200 characters")
    .optional(),
  note: z.string().optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be an ISO date string (YYYY-MM-DD)")
    .optional(),
  assignedTo: z.string().uuid("assignedTo must be a valid UUID").optional(),
})

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>

// ── PATCH /api/activities/[id] — action payload ──────────────────────────────
// Used when caller sends { action: "done" | "cancel" | "reopen" }.
// "done"   → sets doneAt = now(), status = done
// "cancel" → sets status = canceled
// "reopen" → sets status = open, clears doneAt

export const ActionSchema = z.object({
  action: ActivityActionSchema,
})

export type ActionInput = z.infer<typeof ActionSchema>
