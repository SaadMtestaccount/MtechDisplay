/**
 * scripts/seed/ensure.ts — idempotent "find or create" helpers for every seeded row.
 * Every function returns the row id so re-running the seed updates instead of duplicating.
 */
import type { User } from '@supabase/supabase-js'
import type { DbClient, TablesInsert } from '../../types/db'

function fail(step: string, message: string): never {
  throw new Error(`${step}: ${message}`)
}

// --- Auth user + profile --------------------------------------------------------
async function findUserByEmail(admin: DbClient, email: string): Promise<User | null> {
  const wanted = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail('listUsers', error.message)
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === wanted)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

export async function ensureAdminUser(
  admin: DbClient,
  email: string,
  password: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await findUserByEmail(admin, email)
  let id: string
  let created = false
  if (existing) {
    id = existing.id
    const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true })
    if (error) fail('updateUserById', error.message)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'MTech Admin' },
    })
    if (error || !data.user) fail('createUser', error?.message ?? 'no user returned')
    id = data.user.id
    created = true
  }
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id, full_name: 'MTech Admin', is_super_admin: true }, { onConflict: 'id' })
  if (profileError) fail('profiles upsert', profileError.message)
  return { id, created }
}

// --- Organization + membership --------------------------------------------------
export async function ensureOrg(admin: DbClient, name: string, slug: string, timezone: string): Promise<string> {
  const { data, error } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
  if (error) fail('organizations select', error.message)
  if (data) {
    const { error: updErr } = await admin.from('organizations').update({ name, timezone }).eq('id', data.id)
    if (updErr) fail('organizations update', updErr.message)
    return data.id
  }
  const { data: inserted, error: insErr } = await admin
    .from('organizations')
    .insert({ name, slug, timezone })
    .select('id')
    .single()
  if (insErr) fail('organizations insert', insErr.message)
  return inserted.id
}

export async function ensureMembership(admin: DbClient, orgId: string, userId: string): Promise<void> {
  const { error } = await admin
    .from('memberships')
    .upsert({ org_id: orgId, user_id: userId, role: 'owner' }, { onConflict: 'org_id,user_id' })
  if (error) fail('memberships upsert', error.message)
}

// --- Folder ---------------------------------------------------------------------
export async function ensureFolder(admin: DbClient, orgId: string, name: string): Promise<string> {
  const { data, error } = await admin.from('folders').select('id').eq('org_id', orgId).eq('name', name).limit(1).maybeSingle()
  if (error) fail('folders select', error.message)
  if (data) return data.id
  const { data: inserted, error: insErr } = await admin.from('folders').insert({ org_id: orgId, name }).select('id').single()
  if (insErr) fail('folders insert', insErr.message)
  return inserted.id
}

// --- Content --------------------------------------------------------------------
/** Finds the content row by (org, name); returns its id when present. */
export async function findContent(admin: DbClient, orgId: string, name: string): Promise<string | null> {
  const { data, error } = await admin.from('content').select('id').eq('org_id', orgId).eq('name', name).limit(1).maybeSingle()
  if (error) fail('content select', error.message)
  return data?.id ?? null
}

/** Inserts or updates the row with the given id (id is chosen by the caller before uploading). */
export async function upsertContent(admin: DbClient, row: TablesInsert<'content'> & { id: string }): Promise<void> {
  const { error } = await admin.from('content').upsert(row, { onConflict: 'id' })
  if (error) fail('content upsert', error.message)
}

// --- Website --------------------------------------------------------------------
export async function ensureWebsite(admin: DbClient, orgId: string, name: string, url: string): Promise<string> {
  const { data, error } = await admin.from('websites').select('id').eq('org_id', orgId).eq('name', name).limit(1).maybeSingle()
  if (error) fail('websites select', error.message)
  if (data) {
    const { error: updErr } = await admin.from('websites').update({ url, refresh_seconds: 0 }).eq('id', data.id)
    if (updErr) fail('websites update', updErr.message)
    return data.id
  }
  const { data: inserted, error: insErr } = await admin
    .from('websites')
    .insert({ org_id: orgId, name, url, refresh_seconds: 0 })
    .select('id')
    .single()
  if (insErr) fail('websites insert', insErr.message)
  return inserted.id
}

// --- Screen + its playlist ------------------------------------------------------
async function createScreenPlaylist(admin: DbClient, orgId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from('playlists')
    .insert({ org_id: orgId, name, kind: 'screen' })
    .select('id')
    .single()
  if (error) fail('playlists insert', error.message)
  return data.id
}

/** Unpaired placeholder screen with its own `kind 'screen'` playlist; heals a missing playlist on re-run. */
export async function ensureScreen(admin: DbClient, orgId: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from('screens')
    .select('id, playlist_id')
    .eq('org_id', orgId)
    .eq('name', name)
    .limit(1)
    .maybeSingle()
  if (error) fail('screens select', error.message)
  if (data) {
    if (data.playlist_id === null) {
      const playlistId = await createScreenPlaylist(admin, orgId, name)
      const { error: updErr } = await admin.from('screens').update({ playlist_id: playlistId }).eq('id', data.id)
      if (updErr) fail('screens update', updErr.message)
    }
    return data.id
  }
  const playlistId = await createScreenPlaylist(admin, orgId, name)
  const { data: inserted, error: insErr } = await admin
    .from('screens')
    .insert({ org_id: orgId, name, playlist_id: playlistId, device_token_hash: null })
    .select('id')
    .single()
  if (insErr) {
    await admin.from('playlists').delete().eq('id', playlistId)
    fail('screens insert', insErr.message)
  }
  return inserted.id
}
