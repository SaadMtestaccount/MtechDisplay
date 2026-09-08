/**
 * lib/merchants/employees.ts — SERVER ONLY (service role). Employees (CONTRACTS addendum §19):
 * extra logins under a merchant (owner) login. `profiles.employer_id` names the owner; access is a
 * membership per chosen location with role 'admin' (Manager) or 'member' (TV only). Every write
 * returns the owner's refreshed MerchantView so the UI can swap it in.
 */
import { ApiError } from '@/lib/api'
import { getMerchant } from '@/lib/merchants/list'
import type { CreateEmployeeInput, UpdateEmployeeInput } from '@/lib/validators/merchants'
import type { MerchantView } from '@/types/api'
import type { DbClient, MembershipRole } from '@/types/db'

/** The merchant must be a real owner login; returns the ids of the locations it owns. */
async function requireEmployer(admin: DbClient, merchantId: string): Promise<Set<string>> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('is_super_admin, employer_id')
    .eq('id', merchantId)
    .maybeSingle()
  if (error) throw error
  if (!profile) throw new ApiError(404, 'Merchant not found')
  if (profile.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')
  if (profile.employer_id) throw new ApiError(422, 'Employees cannot have employees of their own')
  const { data: memberships, error: membershipsError } = await admin
    .from('memberships')
    .select('org_id')
    .eq('user_id', merchantId)
  if (membershipsError) throw membershipsError
  return new Set((memberships ?? []).map((m) => m.org_id))
}

function assertOwnLocations(orgIds: string[], own: Set<string>): void {
  if (orgIds.length === 0 || orgIds.some((id) => !own.has(id))) {
    throw new ApiError(422, "Pick at least one of this merchant's own locations")
  }
}

async function requireEmployee(admin: DbClient, merchantId: string, employeeId: string): Promise<void> {
  const { data, error } = await admin.from('profiles').select('employer_id').eq('id', employeeId).maybeSingle()
  if (error) throw error
  if (!data || data.employer_id !== merchantId) throw new ApiError(404, 'Employee not found')
}

/** Create the login, point its profile at the owner, and grant the chosen locations. */
export async function createEmployee(
  admin: DbClient,
  merchantId: string,
  input: CreateEmployeeInput,
): Promise<MerchantView> {
  const own = await requireEmployer(admin, merchantId)
  assertOwnLocations(input.org_ids, own)

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
  const rollback = () => admin.auth.admin.deleteUser(user.id).catch(() => undefined)

  // The profile row is created by the auth trigger in the same transaction as the user.
  const { error: profileError } = await admin.from('profiles').update({ employer_id: merchantId }).eq('id', user.id)
  if (profileError) {
    await rollback()
    throw profileError
  }
  const { error: membershipError } = await admin
    .from('memberships')
    .insert(input.org_ids.map((org_id) => ({ org_id, user_id: user.id, role: input.role })))
  if (membershipError) {
    await rollback()
    throw membershipError
  }
  return getMerchant(admin, merchantId)
}

/** Change the access level and/or the set of locations. */
export async function updateEmployee(
  admin: DbClient,
  merchantId: string,
  employeeId: string,
  input: UpdateEmployeeInput,
): Promise<MerchantView> {
  const own = await requireEmployer(admin, merchantId)
  await requireEmployee(admin, merchantId, employeeId)

  const { data: current, error } = await admin.from('memberships').select('org_id, role').eq('user_id', employeeId)
  if (error) throw error
  const currentRole: MembershipRole = (current ?? []).some((m) => m.role === 'admin' || m.role === 'owner')
    ? 'admin'
    : 'member'
  const role: MembershipRole = input.role ?? currentRole

  if (input.org_ids) {
    assertOwnLocations(input.org_ids, own)
    const keep = new Set(input.org_ids)
    const remove = (current ?? []).map((m) => m.org_id).filter((id) => !keep.has(id))
    if (remove.length > 0) {
      const { error: deleteError } = await admin
        .from('memberships')
        .delete()
        .eq('user_id', employeeId)
        .in('org_id', remove)
      if (deleteError) throw deleteError
    }
    const { error: upsertError } = await admin
      .from('memberships')
      .upsert(
        input.org_ids.map((org_id) => ({ org_id, user_id: employeeId, role })),
        { onConflict: 'org_id,user_id' },
      )
    if (upsertError) throw upsertError
  } else if (input.role && input.role !== currentRole) {
    const { error: updateError } = await admin.from('memberships').update({ role }).eq('user_id', employeeId)
    if (updateError) throw updateError
  }
  return getMerchant(admin, merchantId)
}

export async function deleteEmployee(admin: DbClient, merchantId: string, employeeId: string): Promise<void> {
  await requireEmployee(admin, merchantId, employeeId)
  const { error } = await admin.auth.admin.deleteUser(employeeId)
  if (error) {
    if (error.code === 'user_not_found') throw new ApiError(404, 'Employee not found')
    throw error
  }
}

/** Remove every employee login under a merchant (used before deleting the merchant itself). */
export async function deleteEmployeesOf(admin: DbClient, merchantId: string): Promise<void> {
  const { data, error } = await admin.from('profiles').select('id').eq('employer_id', merchantId)
  if (error) throw error
  for (const p of data ?? []) await admin.auth.admin.deleteUser(p.id).catch(() => undefined)
}
