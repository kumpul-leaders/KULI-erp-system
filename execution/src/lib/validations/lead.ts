import { z } from "zod"

// ── Enum literals ────────────────────────────────────────────────────────────

export const PipelineStageSchema = z.enum([
  "leads",
  "pipeline",
  "negotiation",
  "closed_won",
  "lost_deal",
  "invoiced",
  "contract_renewal",
  "no_response",
])

export const LostReasonSchema = z.enum([
  "budget",
  "competitor",
  "timing",
  "no_decision",
  "requirements_mismatch",
  "other",
])

export const ProductLineSchema = z.enum([
  "stracomm",
  "smm",
  "creative_strategy",
  "media_buying",
  "ads_management",
  "production",
  "others",
])

export const ProjectTypeSchema = z.enum(["one_time", "retainer"])

// billingPlan must be "YY-MM" format (e.g. "26-08")
const BillingPlanSchema = z
  .string()
  .regex(/^\d{2}-\d{2}$/, "billingPlan must be in YY-MM format (e.g. 26-08)")

// ── POST /api/leads ──────────────────────────────────────────────────────────
// Required: clientId, productLine, projectType
// Optional: stage, salesId, projectedRevenue, billingPlan, description, notes,
//           expectedCloseDate

export const CreateLeadSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  productLine: ProductLineSchema,
  projectType: ProjectTypeSchema,
  stage: PipelineStageSchema.optional(),
  salesId: z.string().optional().nullable(),
  projectedRevenue: z.number().optional().nullable(),
  billingPlan: BillingPlanSchema.optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  lostReason: LostReasonSchema.optional().nullable(),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

// CreateLeadWithRenewalSchema extends CreateLeadSchema with optional renewedFromLeadId
// Used by POST /api/leads — route handler validates that the source lead exists and is not deleted.
export const CreateLeadWithRenewalSchema = CreateLeadSchema.extend({
  renewedFromLeadId: z.string().uuid("renewedFromLeadId must be a valid UUID").optional().nullable(),
})

export type CreateLeadWithRenewalInput = z.infer<typeof CreateLeadWithRenewalSchema>

// ── PATCH /api/leads/[id] ────────────────────────────────────────────────────
// All fields optional. "stage" is explicitly rejected by the route handler
// (must use POST /stage instead) — not included here.

export const UpdateLeadSchema = z.object({
  clientId: z.string().optional(),
  productLine: ProductLineSchema.optional(),
  projectType: ProjectTypeSchema.optional(),
  salesId: z.string().optional().nullable(),
  projectedRevenue: z.number().optional().nullable(),
  billingPlan: BillingPlanSchema.optional().nullable(),
  actualRevenue: z.number().optional().nullable(),
  lossDealReason: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  closedAt: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  // probability: manual override (0–100) or null to reset to auto
  probability: z.number().min(0).max(100).optional().nullable(),
  // probabilityIsManual: explicit false = reset to auto (re-applies stage default)
  probabilityIsManual: z.boolean().optional(),
  lostReason: LostReasonSchema.optional().nullable(),
})

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>

// ── POST /api/leads/[id]/stage ───────────────────────────────────────────────
// Required: toStage
// Optional: lossDealReason (free text note), lostReason (structured enum)

export const StageTransitionSchema = z.object({
  toStage: PipelineStageSchema,
  lossDealReason: z.string().optional().nullable(),
  lostReason: LostReasonSchema.optional().nullable(),
})

export type StageTransitionInput = z.infer<typeof StageTransitionSchema>

// ── POST /api/leads/bulk ─────────────────────────────────────────────────────
// Required: clientId, productLine, projectType, billingPlans (array 1-36)
// Optional: stage, salesId, projectedRevenue, description, notes,
//           expectedCloseDate

export const BulkCreateLeadSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  productLine: ProductLineSchema,
  projectType: ProjectTypeSchema,
  billingPlans: z
    .array(BillingPlanSchema)
    .min(1, "billingPlans must contain between 1 and 36 entries")
    .max(36, "billingPlans must contain between 1 and 36 entries"),
  stage: PipelineStageSchema.optional(),
  salesId: z.string().optional().nullable(),
  projectedRevenue: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
})

export type BulkCreateLeadInput = z.infer<typeof BulkCreateLeadSchema>

// ── POST /api/leads/bulk-update ──────────────────────────────────────────────
// Required: leadIds (non-empty array), salesId (string | null)

export const BulkUpdateLeadSchema = z.object({
  leadIds: z.array(z.string()).min(1, "leadIds must be a non-empty array"),
  salesId: z.string().nullable(),
})

export type BulkUpdateLeadInput = z.infer<typeof BulkUpdateLeadSchema>

// ── POST /api/leads/bulk-reassign ────────────────────────────────────────────
// Required: fromUserId, toUserId (must differ)

export const BulkReassignSchema = z.object({
  fromUserId: z.string().min(1, "fromUserId is required"),
  toUserId: z.string().min(1, "toUserId is required"),
})

export type BulkReassignInput = z.infer<typeof BulkReassignSchema>
