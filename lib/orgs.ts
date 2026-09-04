import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { ACTIVE_ORG_COOKIE } from '@/types/api'
import type { DbClient, MembershipRole, Organization } from '@/types/db'

// Defined in types/api.ts (isomorphic); this module is server-only (next/headers).
export { ACTIVE_ORG_COOKIE, ACTIVE_ORG_COOKIE_OPTIONS } from '@/types/api'

/** Organizations visible to the session (RLS-filtered), name asc. */
export async function listVisibleOrgs(supabase: DbClient): Promise<Organization[]> {
  const { data, error } = await supabase.from('organizations').select('*').order('name', { ascending: true })
  if (error) throw error
  return data
}

/** Cookie org id if it is visible, else the first visible org, else null. */
export async function getActiveOrg(supabase?: DbClient): Promise<Organization | null> {
  const client = supabase ?? (await createServerClient())
  const orgs = await listVisibleOrgs(client)
  if (orgs.length === 0) return null

  const cookieStore = await cookies()
  const cookieId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
  if (cookieId) {
    const match = orgs.find((org) => org.id === cookieId)
    if (match) return match
  }
  return orgs[0] ?? null
}

/**
 * The user's membership role in an org, or null when they hold no membership (e.g. a super admin
 * who reaches every org through RLS without a membership row). Store managers are 'admin'/'owner'.
 */
export async function getMembershipRole(
  supabase: DbClient,
  orgId: string,
  userId: string,
): Promise<MembershipRole | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role ?? null
}
