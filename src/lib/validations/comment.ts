import { z } from "zod"

// ── POST /api/comments ───────────────────────────────────────────────────────
// body: 1–5000 chars
// At least one of leadId or clientId must be provided — enforced via superRefine.
// mentions is NOT accepted from client — server-side parsed from body.

export const CreateCommentSchema = z
  .object({
    body: z
      .string()
      .min(1, "body is required")
      .max(5000, "body must be at most 5000 characters"),
    leadId: z.string().uuid("leadId must be a valid UUID").optional().nullable(),
    clientId: z
      .string()
      .uuid("clientId must be a valid UUID")
      .optional()
      .nullable(),
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

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>

// ── PATCH /api/comments/[id] ─────────────────────────────────────────────────

export const UpdateCommentSchema = z.object({
  body: z
    .string()
    .min(1, "body is required")
    .max(5000, "body must be at most 5000 characters"),
})

export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>
