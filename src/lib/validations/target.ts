import { z } from "zod"

// ── Enum ─────────────────────────────────────────────────────────────────────

export const TargetTypeSchema = z.enum(["monthly", "quarterly"])

// ── POST /api/targets (upsert) ───────────────────────────────────────────────
// Required: periodYear, periodMonth, revenueTarget, type
// Optional: newClientTarget, salesId
//
// Validation mirrors the route handler:
//   - periodYear: 2020-2100
//   - revenueTarget: >= 0
//   - periodMonth: 1-12 for monthly, 1-4 for quarterly (cross-field — enforced in route)

export const CreateTargetSchema = z
  .object({
    periodYear: z
      .number()
      .int()
      .min(2020, "periodYear must be a valid year")
      .max(2100, "periodYear must be a valid year"),
    periodMonth: z.number().int(),
    revenueTarget: z.number().min(0, "revenueTarget must be a non-negative number"),
    newClientTarget: z.number().int().min(0).optional(),
    type: TargetTypeSchema,
    salesId: z.string().optional().nullable(),
  })
  // Cross-field: periodMonth range depends on type
  .superRefine((data, ctx) => {
    const maxMonth = data.type === "quarterly" ? 4 : 12
    if (data.periodMonth < 1 || data.periodMonth > maxMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodMonth"],
        message:
          data.type === "quarterly"
            ? "periodMonth must be 1-4 for quarterly targets"
            : "periodMonth must be 1-12 for monthly targets",
      })
    }
  })

export type CreateTargetInput = z.infer<typeof CreateTargetSchema>

// ── PATCH /api/targets/[id] ──────────────────────────────────────────────────
// All fields optional — partial update.

export const UpdateTargetSchema = z.object({
  revenueTarget: z.number().min(0, "revenueTarget must be a non-negative number").optional(),
  newClientTarget: z.number().int().min(0, "newClientTarget must be a non-negative number").optional(),
  salesId: z.string().nullable().optional(),
})

export type UpdateTargetInput = z.infer<typeof UpdateTargetSchema>
