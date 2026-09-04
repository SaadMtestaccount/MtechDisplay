/**
 * lib/merchants.ts — SERVER ONLY (service role). Merchants = the stores that use MSIGN
 * (CONTRACTS addendum §13). A merchant is one login (auth user) with one or more locations
 * (each location is an org). Creating a merchant makes the login AND the first location together;
 * more locations are added from the merchant's account, optionally copying an existing location's
 * content and menus. role 'member' = TV display only; 'admin' = a manager who uses the console.
 */
import { randomUUID } from 'node:crypto'
import { ApiError } from '@/lib/api'
import { slugify } from '@/lib/utils'
import type { AddLocationInput, CreateMerchantInput } from '@/lib/validators/merchants'
import type { MerchantView, SubscriptionTier } from '@/types/api'
import { SUBSCRIPTION_TIERS } from '@/types/api'
import type { DbClient, MembershipRole } from '@/types/db'

/** Coerce a stored tier string to a known tier, defaulting to the first. */
function toTier(value: string | null | undefined): SubscriptionTier {
  return (SUBSCRIPTION_TIERS as readonly string[]).includes(value ?? '')
    ? (value as SubscriptionTier)
    : SUBSCRIPTION_TIERS[0]
}

type MembershipWithOrg = {
  user_id: string
  role: MembershipRole
  organizations: { id: string; name: string } | null
}

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

/** Non-super-admin logins, each with all their locations aggregated onto one row. */
export async function listMerchants(admin: DbClient): Promise<MerchantView[]> {
  const { data: memberships, error } = await admin
    .from('memberships')
    .select('user_id, role, organizations(id, name)')
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (memberships ?? []) as MembershipWithOrg[]
  if (rows.length === 0) return []

  const ids = Array.from(new Set(rows.map((m) => m.user_id)))
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, is_super_admin, subscription_tier')
    .in('id', ids)
  if (profilesError) throw profilesError
  const superAdmin = new Set((profiles ?? []).filter((p) => p.is_super_admin).map((p) => p.id))
  const tierById = new Map((profiles ?? []).map((p) => [p.id, toTier(p.subscription_tier)] as const))

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) throw usersError
  const byId = new Map(users.users.map((u) => [u.id, u] as const))

  const grouped = new Map<string, MerchantView>()
  for (const m of rows) {
    if (superAdmin.has(m.user_id)) continue
    const user = byId.get(m.user_id)
    if (!user) continue
    let view = grouped.get(m.user_id)
    if (!view) {
      view = {
        id: m.user_id,
        email: user.email ?? '',
        role: m.role,
        locations: [],
        subscription_tier: tierById.get(m.user_id) ?? SUBSCRIPTION_TIERS[0],
        last_sign_in_at: user.last_sign_in_at ?? null,
        created_at: user.created_at,
      }
      grouped.set(m.user_id, view)
    }
    if (m.role === 'admin' || m.role === 'owner') view.role = 'admin'
    if (m.organizations) view.locations.push({ id: m.organizations.id, name: m.organizations.name })
  }
  return Array.from(grouped.values()).sort((a, b) => a.email.localeCompare(b.email))
}

export async function getMerchant(admin: DbClient, userId: string): Promise<MerchantView> {
  const view = (await listMerchants(admin)).find((m) => m.id === userId)
  if (!view) throw new ApiError(404, 'Merchant not found')
  return view
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
    locations: [location],
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

export async function setMerchantPassword(admin: DbClient, userId: string, password: string): Promise<void> {
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
 * Delete a merchant: removes their login AND every location that belongs only to them (each
 * location is a one-merchant org, so deleting the org cascades its screens, content and menus).
 */
export async function deleteMerchant(admin: DbClient, userId: string, currentUserId: string): Promise<void> {
  if (userId === currentUserId) throw new ApiError(400, 'You cannot remove yourself')
  const { data: profile } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle()
  if (profile?.is_super_admin) throw new ApiError(422, 'That is an MTech staff account, not a merchant')

  const { data: memberships, error } = await admin.from('memberships').select('org_id').eq('user_id', userId)
  if (error) throw error
  const orgIds = (memberships ?? []).map((m) => m.org_id)

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserError) {
    if (deleteUserError.code === 'user_not_found') throw new ApiError(404, 'Merchant not found')
    throw deleteUserError
  }
  if (orgIds.length > 0) await admin.from('organizations').delete().in('id', orgIds)
}

/**
 * Copy a location's content (media + thumbnails, via Storage copy) and menus (with their items
 * remapped to the new content) into another location. Best effort per item; a failed item is
 * skipped so the rest still copies.
 */
export async function copyLocationContent(admin: DbClient, fromOrg: string, toOrg: string): Promise<void> {
  const { data: content, error: contentError } = await admin.from('content').select('*').eq('org_id', fromOrg)
  if (contentError) throw contentError
  const contentMap = new Map<string, string>()
  for (const item of content ?? []) {
    const newId = randomUUID()
    const ext = item.storage_path.split('.').pop() ?? 'bin'
    const newMediaPath = `${toOrg}/${newId}.${ext}`
    const newThumbPath = item.thumb_path ? `${toOrg}/${newId}-thumb.jpg` : null

    const { error: mediaError } = await admin.storage.from('media').copy(item.storage_path, newMediaPath)
    if (mediaError) {
      console.warn('[copy] media', item.storage_path, mediaError.message)
      continue
    }
    if (item.thumb_path && newThumbPath) {
      const { error: thumbError } = await admin.storage.from('thumbs').copy(item.thumb_path, newThumbPath)
      if (thumbError) console.warn('[copy] thumb', item.thumb_path, thumbError.message)
    }
    const { error: insertError } = await admin.from('content').insert({
      id: newId,
      org_id: toOrg,
      folder_id: null,
      name: item.name,
      type: item.type,
      storage_path: newMediaPath,
      thumb_path: newThumbPath,
      mime: item.mime,
      size_bytes: item.size_bytes,
      width: item.width,
      height: item.height,
      duration_seconds: item.duration_seconds,
      expires_at: null,
      created_by: item.created_by,
    })
    if (insertError) {
      console.warn('[copy] content row', insertError.message)
      continue
    }
    contentMap.set(item.id, newId)
  }

  const { data: websites } = await admin.from('websites').select('*').eq('org_id', fromOrg)
  const websiteMap = new Map<string, string>()
  for (const site of websites ?? []) {
    const newId = randomUUID()
    const { error } = await admin
      .from('websites')
      .insert({ id: newId, org_id: toOrg, name: site.name, url: site.url, refresh_seconds: site.refresh_seconds })
    if (error) continue
    websiteMap.set(site.id, newId)
  }

  const { data: menus } = await admin.from('playlists').select('*').eq('org_id', fromOrg).eq('kind', 'menu')
  for (const menu of menus ?? []) {
    const { data: newMenu, error: menuError } = await admin
      .from('playlists')
      .insert({ org_id: toOrg, name: menu.name, kind: 'menu' })
      .select('id')
      .single()
    if (menuError || !newMenu) continue
    const { data: items } = await admin
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', menu.id)
      .order('position', { ascending: true })
    const rows = (items ?? [])
      .map((it) => {
        const contentId = it.content_id ? (contentMap.get(it.content_id) ?? null) : null
        const websiteId = it.website_id ? (websiteMap.get(it.website_id) ?? null) : null
        if (it.item_type === 'content' && !contentId) return null
        if (it.item_type === 'website' && !websiteId) return null
        return {
          id: randomUUID(),
          playlist_id: newMenu.id,
          position: it.position,
          item_type: it.item_type,
          content_id: contentId,
          website_id: websiteId,
          duration_seconds: it.duration_seconds,
          transition: it.transition,
          mute: it.mute,
          active_from: it.active_from,
          active_to: it.active_to,
          days_of_week: it.days_of_week,
          daily_start: it.daily_start,
          daily_end: it.daily_end,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (rows.length > 0) await admin.from('playlist_items').insert(rows)
  }
}
