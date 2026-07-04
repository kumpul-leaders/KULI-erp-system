import { z } from "zod"

// ── Enum ─────────────────────────────────────────────────────────────────────

export const NotificationTypeSchema = z.enum([
  "mention",
  "lead_assigned",
  "activity_due",
  "activity_overdue",
  "alert",
  "stage_change",
])

export type NotificationTypeValue = z.infer<typeof NotificationTypeSchema>

// ── Helper input schema (for internal use) ────────────────────────────────────

export const CreateNotificationInputSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  type: NotificationTypeSchema,
  title: z.string().min(1, "title is required").max(255, "title too long"),
  body: z.string().max(1000, "body too long").optional().nullable(),
  entityType: z.string().max(50).optional().nullable(),
  entityId: z.string().uuid("entityId must be a valid UUID").optional().nullable(),
})

export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>

// ── PATCH /api/notifications/[id] body ───────────────────────────────────────

export const MarkReadSchema = z.object({
  action: z.literal("read"),
})

export type MarkReadInput = z.infer<typeof MarkReadSchema>
