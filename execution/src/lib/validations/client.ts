import { z } from "zod"

// ── Enum literals ────────────────────────────────────────────────────────────

export const EngagementTypeSchema = z.enum(["retainer", "project", "both"])
export const HealthStatusSchema = z.enum(["healthy", "at_risk", "churned"])
export const ClientStatusSchema = z.enum(["active", "inactive", "lead"])

// ── POST /api/clients ────────────────────────────────────────────────────────
// Required: name
// Optional: industry, orgSize, officeAddress, healthStatus, clientStatus,
//           primaryAe, customerCode, notes, engagementType (auto-defaults "project")
// Allowed: initialContact — creates a primary contact inline after client creation

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  engagementType: EngagementTypeSchema.optional(),
  industry: z.string().optional().nullable(),
  orgSize: z.string().optional().nullable(),
  officeAddress: z.string().optional().nullable(),
  healthStatus: HealthStatusSchema.optional(),
  clientStatus: ClientStatusSchema.optional().nullable(),
  primaryAe: z.string().optional().nullable(),
  customerCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  initialContact: z
    .object({
      name: z.string().min(1),
      role: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional().nullable(),
    })
    .optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>

// ── PATCH /api/clients/[id] ──────────────────────────────────────────────────
// All fields optional — partial update.

export const UpdateClientSchema = z.object({
  name: z.string().min(1, "Client name cannot be empty").optional(),
  engagementType: EngagementTypeSchema.optional(),
  industry: z.string().optional().nullable(),
  orgSize: z.string().optional().nullable(),
  officeAddress: z.string().optional().nullable(),
  healthStatus: HealthStatusSchema.optional(),
  clientStatus: ClientStatusSchema.optional().nullable(),
  primaryAe: z.string().optional().nullable(),
  customerCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
