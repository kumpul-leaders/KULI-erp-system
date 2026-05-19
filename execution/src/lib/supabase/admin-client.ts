import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client for admin operations (invite users, delete auth users).
 * Requires SUPABASE_SERVICE_ROLE_KEY env var — get it from:
 * Supabase Dashboard → Project Settings → API → Service Role key
 *
 * Add to .env.local AND Vercel environment variables.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
