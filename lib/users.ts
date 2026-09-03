/**
 * lib/users.ts — MTech staff management via auth.admin (docs/CONTRACTS.md §5.21). Server-only.
 * Every invited user is a super admin (v1: staff only).
 */
import type { User } from '@supabase/supabase-js'
import type { DbClient, Profile } from '@/types/db'
import type { UserView } from '@/types/api'
import { ApiError } from '@/lib/api'

type ProfileBits = Pick<Profile, 'id' | 'full_name' | 'is_super_admin'>

function toUserView(user: User, profile: ProfileBits | undefined): UserView {
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: profile?.full_name ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    created_at: user.created_at,
    is_super_admin: profile?.is_super_admin ?? false,
  }
}

async function loadProfiles(admin: DbClient, ids: string[]): Promise<Map<string, ProfileBits>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await admin.from('profiles').select('id, full_name, is_super_admin').in('id', ids)
  if (error) throw error
  return new Map(data.map((p) => [p.id, p] as const))
}

export async function listUsers(admin: DbClient): Promise<UserView[]> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const profiles = await loadProfiles(
    admin,
    data.users.map((u) => u.id),
  )
  return data.users
    .map((u) => toUserView(u, profiles.get(u.id)))
    .sort((a, b) => a.email.localeCompare(b.email))
}

/** Sends the Supabase invite email and marks the new profile as super admin. */
export async function inviteUser(admin: DbClient, email: string): Promise<UserView> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/set-password`,
  })
  if (error) {
    if (error.code === 'email_exists') throw new ApiError(409, 'A user with this email already exists')
    throw error
  }
  const user = data.user
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert({ id: user.id, is_super_admin: true }, { onConflict: 'id' })
    .select('id, full_name, is_super_admin')
    .single()
  if (profileError) throw profileError
  return toUserView(user, profile)
}

export async function removeUser(admin: DbClient, id: string, currentUserId: string): Promise<void> {
  if (id === currentUserId) throw new ApiError(400, 'You cannot remove yourself')
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) {
    if (error.code === 'user_not_found') throw new ApiError(404, 'User not found')
    throw error
  }
}
