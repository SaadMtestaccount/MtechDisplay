/**
 * lib/merchants.ts — SERVER ONLY (service role). Merchant TV accounts (CONTRACTS addendum §13):
 * non-staff auth users with one org membership (role 'member'). MTech sets the password
 * directly; merchants sign in only on the TV player (the admin shell redirects them away).
 * Removal reuses lib/users.ts removeUser via DELETE /api/users/[id].
 */
import { ApiError } from '@/lib/api'
import type { CreateMerchantInput } from '@/lib/validators/merchants'
import type { MerchantView } from '@/types/api'
import type { DbClient } from '@/types/db'

type MembershipWithOrg = { user_id: string; org_id: string; organizations: { name: string } | null }

/** Non-super-admin users that hold at least one membership, with their org name. */
export async function listMerchants(admin: DbClient): Promise<MerchantView[]> {
  const { data: memberships, error } = await admin
    .from('memberships')
    .select('user_id, org_id, organizations(name)')
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (memberships ?? []) as MembershipWithOrg[]
  if (rows.length === 0) return []

  const ids = Array.from(new Set(rows.map((m) => m.user_id)))
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, is_super_admin')
    .in('id', ids)
  if (profilesError) throw profilesError
  const superAdmin = new Set((profiles ?? []).filter((p) => p.is_super_admin).map((p) => p.id))

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) throw usersError
  const byId = new Map(users.users.map((u) => [u.id, u] as const))

  const views: MerchantView[] = []
  for (const m of rows) {
    if (superAdmin.has(m.user_id)) continue
    const user = byId.get(m.user_id)
    if (!user) continue
    if (views.some((v) => v.id === m.user_id)) continue // first membership wins in the list
    views.push({
      id: m.user_id,
      email: user.email ?? '',
      org_id: m.org_id,
      org_name: m.organizations?.name ?? 'Unknown organization',
      last_sign_in_at: user.last_sign_in_at ?? null,
      created_at: user.created_at,
    })
  }
  return views.sort((a, b) => a.email.localeCompare(b.email))
}

/** Creates the auth user (password set, email confirmed) + a role 'member' membership. */
export async function createMerchant(admin: DbClient, input: CreateMerchantInput): Promise<MerchantView> {
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', input.org_id)
    .maybeSingle()
  if (orgError) throw orgError
  if (!org) throw new ApiError(422, 'Unknown organization')

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })
  if (error) {
    if (error.code === 'email_exists') throw new ApiError(409, 'A user with this email already exists')
    throw error
  }
  const user = data.user

  const { error: membershipError } = await admin
    .from('memberships')
    .upsert({ org_id: input.org_id, user_id: user.id, role: 'member' }, { onConflict: 'org_id,user_id' })
  if (membershipError) {
    await admin.auth.admin.deleteUser(user.id).catch((e: unknown) => console.error('[merchants] cleanup', e))
    throw membershipError
  }

  return {
    id: user.id,
    email: user.email ?? input.email,
    org_id: org.id,
    org_name: org.name,
    last_sign_in_at: null,
    created_at: user.created_at,
  }
}
