import { createClient } from '@supabase/supabase-js'
import type { Database, DbClient } from '@/types/db'

/**
 * Service-role client. Bypasses RLS. NEVER import from client code. New instance per call —
 * it opens no socket (server code never subscribes; broadcast uses REST).
 */
export function createAdminClient(): DbClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
