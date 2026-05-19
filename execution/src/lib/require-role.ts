import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export interface AuthUser {
  id: string
  role: string
}

/**
 * Verify the current Supabase session and check that the DB user has one of
 * the specified roles. Returns the AuthUser if authorized, null otherwise.
 */
export async function requireRole(...roles: string[]): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user || !user.email) return null

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true },
  })
  if (!dbUser || !roles.includes(dbUser.role)) return null

  return { id: dbUser.id, role: dbUser.role }
}

// ── Named shortcuts ──────────────────────────────────────────────────────────

/** Super Admin only */
export const requireAdmin = () => requireRole("admin")

/** Admin or Commercial Director */
export const requireAdminOrDirector = () =>
  requireRole("admin", "commercial_director")

/** Admin or Commercial Director (client create/edit) */
export const requireCanEditClients = () =>
  requireRole("admin", "commercial_director", "account_manager")

/** Admin, Commercial Director, or Account (can create/edit leads) */
export const requireCanCreateLeads = () =>
  requireRole("admin", "commercial_director", "account_manager", "account")

/** Any authenticated DB user */
export const requireAuthenticated = () =>
  requireRole("admin", "commercial_director", "account_manager", "account", "operation")
