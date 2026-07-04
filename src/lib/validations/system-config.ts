import { z } from "zod"

// ── PATCH /api/system-config/[key] ──────────────────────────────────────────
// Body: { value: unknown }
// The key is validated via URL param allowlist in the route handler.
// The value is intentionally freeform JSON — we preserve z.unknown() here.

export const UpdateSystemConfigSchema = z.object({
  value: z.unknown(),
})

export type UpdateSystemConfigInput = z.infer<typeof UpdateSystemConfigSchema>
