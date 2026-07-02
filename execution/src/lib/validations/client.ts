import { z } from "zod"

// ── Enum literals ────────────────────────────────────────────────────────────

export const EngagementTypeSchema = z.enum(["retainer", "project", "both"])
export const HealthStatusSchema = z.enum(["healthy", "at_risk", "churned"])
export const ClientStatusSchema = z.enum(["active", "inactive", "lead"])

// ── POST /api/clients ────────────────────────────────────────────────────────
// Required: name, engagementType
// Optional: industry, orgSize, contractStart, contractEnd, monthlyValue,
//           annualValue, healthStatus, clientStatus, primaryAe, customerCode, notes

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  engagementType: EngagementTypeSchema,
  industry: z.string().optional().nullable(),
  orgSize: z.string().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  monthlyValue: z.number().optional().nullable(),
  annualValue: z.number().optional().nullable(),
  healthStatus: HealthStatusSchema.optional(),
  clientStatus: ClientStatusSchema.optional().nullable(),
  primaryAe: z.string().optional().nullable(),
  customerCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>

// ── PATCH /api/clients/[id] ──────────────────────────────────────────────────
// All fields optional — partial update.

export const UpdateClientSchema = z.object({
  name: z.string().min(1, "Client name cannot be empty").optional(),
  engagementType: EngagementTypeSchema.optional(),
  industry: z.string().optional().nullable(),
  orgSize: z.string().optional().nullable(),
  contractStart: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  monthlyValue: z.number().optional().nullable(),
  annualValue: z.number().optional().nullable(),
  healthStatus: HealthStatusSchema.optional(),
  clientStatus: ClientStatusSchema.optional().nullable(),
  primaryAe: z.string().optional().nullable(),
  customerCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>
