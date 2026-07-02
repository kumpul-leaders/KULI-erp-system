import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client for privileged server-side operations.
 * - Used for storage uploads/signed-URL generation (pipeline-docs bucket)
 * - Used for admin auth operations (invite users, delete auth users)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and Vercel env vars.
 * This module is server-only — the `import "server-only"` guard prevents
 * accidental inclusion in client bundles.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add both to .env.local and Vercel environment variables."
    )
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
