import type { User } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api'
import { getActiveOrg } from '@/lib/orgs'
import { createServerClient } from '@/lib/supabase/server'
import type { DbClient, Organization, Profile } from '@/types/db'

/** `supabase` is the session-bound server client (RLS enforced). */
export type SessionContext = { user: User; profile: Profile; supabase: DbClient }
export type OrgContext = SessionContext & { org: Organization }

/** Non-throwing (layouts). Uses auth.getUser() — never getSession() on the server. */
export async function getSessionUser(): Promise<SessionContext | null> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) {
    console.error('[auth] profile lookup failed', error.message)
    return null
  }
  if (!profile) {
    console.warn('[auth] no profile row for user', user.id)
    return null
  }
  return { user, profile, supabase }
}

export async function requireUser(): Promise<SessionContext> {
  const session = await getSessionUser()
  if (!session) throw new ApiError(401, 'Unauthorized')
  return session
}

export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await requireUser()
  if (!session.profile.is_super_admin) throw new ApiError(403, 'Forbidden')
  return session
}

export async function requireOrgContext(): Promise<OrgContext> {
  const session = await requireUser()
  const org = await getActiveOrg(session.supabase)
  if (!org) throw new ApiError(400, 'No active organization')
  return { ...session, org }
}
