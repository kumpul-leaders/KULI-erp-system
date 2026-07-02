import { z } from "zod"

// ── Enum ─────────────────────────────────────────────────────────────────────

export const UpsellStatusSchema = z.enum(["identified", "pitched", "won", "lost"])

// ── POST /api/clients/[id]/upsells ──────────────────────────────────────────
// Required: service
// Optional: status, estimatedValue, notes

export const CreateUpsellSchema = z.object({
  service: z.string().min(1, "Service name is required"),
  status: UpsellStatusSchema.optional(),
  estimatedValue: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type CreateUpsellInput = z.infer<typeof CreateUpsellSchema>

// ── PATCH /api/upsells/[upsellId] ────────────────────────────────────────────
// All fields optional — partial update.

export const UpdateUpsellSchema = z.object({
  service: z.string().min(1, "Service name cannot be empty").optional(),
  status: UpsellStatusSchema.optional(),
  estimatedValue: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type UpdateUpsellInput = z.infer<typeof UpdateUpsellSchema>
