import { z } from "zod"

const EmailSchema = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address")

// ── POST /api/clients/[id]/contacts ─────────────────────────────────────────
// Required: name
// Optional: role, email, phone, isPrimary

export const CreateContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  role: z.string().optional().nullable(),
  email: EmailSchema.optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
})

export type CreateContactInput = z.infer<typeof CreateContactSchema>

// ── PATCH /api/contacts/[contactId] ─────────────────────────────────────────
// All fields optional — partial update.

export const UpdateContactSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  role: z.string().optional().nullable(),
  email: EmailSchema.optional().nullable(),
  phone: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
})

export type UpdateContactInput = z.infer<typeof UpdateContactSchema>
