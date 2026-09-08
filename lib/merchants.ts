/**
 * lib/merchants.ts — SERVER ONLY (service role). Merchants = the stores that use MSIGN
 * (CONTRACTS addendum §13, §19). A merchant is one owner login (auth user) with one or more
 * locations (each location is an org) and, optionally, employee logins under it. Creating a
 * merchant makes the login AND the first location together; more locations are added from the
 * merchant's account, optionally copying an existing location's content and menus. role 'member'
 * = TV display only; 'admin' = a manager who uses the console.
 *
 * Reads live in lib/merchants/list.ts, employees in lib/merchants/employees.ts and the content
 * copier in lib/merchants/copy.ts; all are re-exported here so routes import one module.
 */
import { ApiError } from '@/lib/api'
import { copyLocationContent } from '@/lib/merchants/copy'
import { deleteEmployeesOf } from '@/lib/merchants/employees'
import { getMerchant } from '@/lib/merchants/list'
import { slugify } from '@/lib/utils'
import type { AddLocationInput, CreateMerchantInput } from '@/lib/validators/merchants'
import type { MerchantView, SubscriptionTier } from '@/types/api'
import { SUBSCRIPTION_TIERS } from '@/types/api'
import type { DbClient, MembershipRole } from '@/types/db'

export { listMerchants, getMerchant } from '@/lib/merchants/list'
export { createEmployee, updateEmployee, deleteEmployee } from '@/lib/merchants/employees'
export { copyLocationContent } from '@/lib/merchants/copy'

async function uniqueSlug(admin: DbClient, name: string): Promise<string> {
  const base = slugify(name) || 'location'
  const { data, error } = await admin.from('organizations').select('slug').like('slug', `${base}%`)
  if (error) throw error
  const taken = new Set((data ?? []).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Create a location (organization) with a unique slug. */
async function createLocationOrg(admin: DbClient, name: string): Promise<{ id: string; name: string }> {
  const slug = await uniqueSlug(admin, name)
  const { data, error } = await admin.from('organizations').insert({ name, slug }).select('id, name').single()
  if (error) throw error
  return { id: data.id, name: data.name }
}

/** Create the login + its first location together. */
export async function createMerchant(admin: DbClient, input: CreateMerchantInput): Promise<MerchantView> {
  const location = await createLocationOrg(admin, input.location_name)
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })
  if (error) {
    await admin.from('organizations').delete().eq('id', location.id)
    if (error.code === 'email_exists') throw new ApiError(409, 'A user with this email already exists')
    throw error
  }
  const user = data.user
  const { error: membershipError } = await admin
    .from('memberships')
    .insert({ org_id: location.id, user_id: user.id, role: input.role })
  if (membershipError) {
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined)
    await admin.from('organizations').delete().eq('id', location.id)
    throw membershipError
  }
  return {
    id: user.id,
    email: user.email ?? input.email,
    role: input.role,
    locations: [{ ...location, screen_count: 0, content_count: 0 }],
    employees: [],
    subscription_tier: SUBSCRIPTION_TIERS[0],
    last_sign_in_at: null,
    created_at: user.created_at,
  }
}

/** Add a location to an existing merchant, optionally copying content + menus from one of theirs. */
export async function addMerchantLocation(admin: DbClient, userId: string, input: AddLocationInput): Promise<MerchantView> {
  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle()
  if (profile?.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')

  const { data: existing, error } = await admin.from('memberships').select('org_id, role').eq('user_id', userId)
  if (error) throw error
  if (!existing || existing.length === 0) throw new ApiError(404, 'Merchant not found')
  if (input.copy_from_org_id && !existing.some((m) => m.org_id === input.copy_from_org_id)) {
    throw new ApiError(422, "You can only copy from one of this merchant's own locations")
  }
  const role: MembershipRole = existing.some((m) => m.role === 'admin' || m.role === 'owner') ? 'admin' : 'member'

  const location = await createLocationOrg(admin, input.location_name)
  const { error: membershipError } = await admin
    .from('memberships')
    .insert({ org_id: location.id, user_id: userId, role })
  if (membershipError) {
    await admin.from('organizations').delete().eq('id', location.id)
    throw membershipError
  }
  if (input.copy_from_org_id) await copyLocationContent(admin, input.copy_from_org_id, location.id)
  return getMerchant(admin, userId)
}

/** Works for a merchant's own login and for any of its employees. */
export async function setMerchantPassword(admin: DbClient, userId: string, password: string): Promise<void> {
  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle()
  if (profile?.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) throw error
}

/** Set a merchant's (dummy) subscription tier on their profile. */
export async function setMerchantSubscription(admin: DbClient, userId: string, tier: SubscriptionTier): Promise<void> {
  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle()
  if (profile?.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')
  const { error } = await admin.from('profiles').update({ subscription_tier: tier }).eq('id', userId)
  if (error) throw error
}

/**
 * Delete a merchant: removes their employees' logins, their own login AND every location that
 * belongs to them (each location is a one-merchant org, so deleting the org cascades its
 * screens, content and menus).
 */
export async function deleteMerchant(admin: DbClient, userId: string, currentUserId: string): Promise<void> {
  if (userId === currentUserId) throw new ApiError(400, 'You cannot remove yourself')
  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle()
  if (profile?.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')

  const { data: memberships, error } = await admin.from('memberships').select('org_id').eq('user_id', userId)
  if (error) throw error
  const orgIds = (memberships ?? []).map((m) => m.org_id)

  await deleteEmployeesOf(admin, userId)
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserError) {
    if (deleteUserError.code === 'user_not_found') throw new ApiError(404, 'Merchant not found')
    throw deleteUserError
  }
  if (orgIds.length > 0) await admin.from('organizations').delete().in('id', orgIds)
}
