/**
 * lib/screens/mutations.ts — SERVER ONLY. Claim / update / delete / actions / version bumps.
 */
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { broadcastToScreens, notifyOrgChanged } from '@/lib/broadcast'
import { logEvent } from '@/lib/events'
import { createPlaylist, deletePlaylist } from '@/lib/playlists'
import { generateLoginCode } from '@/lib/screens/codes'
import { getScreenView } from '@/lib/screens/views'
import type { ClaimScreenInput, ScreenUpdateInput } from '@/lib/validators/screens'
import { PAIRING_CODE_TTL_MS, type ScreenAction, type ScreenView } from '@/types/api'
import type { DbClient, Screen, TablesInsert } from '@/types/db'

function isPgError(e: unknown): e is { code: string; message: string } {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string'
}

/** rpc bump_screen_versions → `sync` to the updated screens; no-op for []. */
export async function bumpAndSyncScreens(admin: DbClient, screenIds: string[]): Promise<void> {
  const ids = Array.from(new Set(screenIds))
  if (ids.length === 0) return
  const { data, error } = await admin.rpc('bump_screen_versions', { p_screen_ids: ids })
  if (error) throw error
  await broadcastToScreens(data ?? [], 'sync')
}

/** Every screen of the org refetches its manifest (org name / timezone / logo changes). */
export async function syncOrgScreens(admin: DbClient, orgId: string): Promise<void> {
  const { data, error } = await admin.from('screens').select('id').eq('org_id', orgId)
  if (error) throw error
  await bumpAndSyncScreens(admin, data.map((s) => s.id))
}

/** playlist (kind 'screen', name) then screen; deletes the playlist if the screen insert fails. */
export async function createScreenWithPlaylist(
  ctx: OrgContext,
  name: string,
  extra?: Partial<TablesInsert<'screens'>>,
): Promise<Screen> {
  const playlist = await createPlaylist(ctx.supabase, ctx.org.id, name, 'screen')
  const { data, error } = await ctx.supabase
    .from('screens')
    .insert({ ...extra, org_id: ctx.org.id, name, playlist_id: playlist.id })
    .select('*')
    .single()
  if (error) {
    await deletePlaylist(ctx.supabase, playlist.id).catch((e: unknown) => console.error('[screens] cleanup', e))
    throw error
  }
  return data
}

/** Create a bare TV (unpaired) with a unique login code + its own playlist (docs/CONTRACTS.md §15). */
export async function createScreen(ctx: OrgContext, name: string): Promise<ScreenView> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const screen = await createScreenWithPlaylist(ctx, name, { login_code: generateLoginCode() })
      await notifyOrgChanged(ctx.org.id, 'screens', screen.id)
      return getScreenView(ctx.supabase, ctx.org.id, screen.id)
    } catch (e) {
      if (isPgError(e) && e.code === '23505') continue // login_code collision, retry
      throw e
    }
  }
  throw new ApiError(500, 'Could not allocate a unique code')
}

/** New login code + revoke the currently-bound TV (that one screen logs out). */
export async function regenerateScreenCode(ctx: OrgContext, admin: DbClient, id: string): Promise<ScreenView> {
  await getScreenView(ctx.supabase, ctx.org.id, id) // 404 if not in org
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateLoginCode()
    const { error } = await admin
      .from('screens')
      .update({ login_code: code, device_token_hash: null, paired_at: null })
      .eq('id', id)
      .eq('org_id', ctx.org.id)
    if (!error) {
      await broadcastToScreens([id], 'unpair')
      await notifyOrgChanged(ctx.org.id, 'screens', id)
      return getScreenView(ctx.supabase, ctx.org.id, id)
    }
    if (isPgError(error) && error.code === '23505') continue
    throw error
  }
  throw new ApiError(500, 'Could not allocate a unique code')
}

export async function claimScreen(ctx: OrgContext, admin: DbClient, input: ClaimScreenInput): Promise<ScreenView> {
  const now = new Date()
  const nowIso = now.toISOString()
  const { data: code, error: codeError } = await admin
    .from('pairing_codes')
    .select('code, device_token_hash')
    .eq('code', input.code)
    .is('claimed_screen_id', null)
    .gt('expires_at', nowIso)
    .maybeSingle()
  if (codeError) throw codeError
  if (!code) throw new ApiError(404, 'Code not found or expired')

  let screen: Screen
  try {
    screen = await createScreenWithPlaylist(ctx, input.name, {
      device_token_hash: code.device_token_hash,
      paired_at: nowIso,
    })
  } catch (e) {
    if (isPgError(e) && e.code === '23505') throw new ApiError(409, 'Code already claimed')
    throw e
  }

  const { data: claimed, error: claimError } = await admin
    .from('pairing_codes')
    .update({ claimed_screen_id: screen.id, expires_at: new Date(now.getTime() + PAIRING_CODE_TTL_MS).toISOString() })
    .eq('code', input.code)
    .is('claimed_screen_id', null)
    .gt('expires_at', nowIso)
    .select('id')
  if (claimError || !claimed || claimed.length !== 1) {
    await admin.from('screens').delete().eq('id', screen.id)
    if (screen.playlist_id) await deletePlaylist(admin, screen.playlist_id).catch(() => undefined)
    if (claimError) throw claimError
    throw new ApiError(409, 'Code already claimed')
  }

  await logEvent(ctx.supabase, { org_id: ctx.org.id, screen_id: screen.id, type: 'screen_paired', payload: { name: screen.name } })
  await notifyOrgChanged(ctx.org.id, 'screens', screen.id)
  return getScreenView(ctx.supabase, ctx.org.id, screen.id)
}

export async function updateScreen(
  ctx: OrgContext,
  admin: DbClient,
  id: string,
  input: ScreenUpdateInput,
): Promise<ScreenView> {
  const current = await getScreenView(ctx.supabase, ctx.org.id, id)

  if (input.group_id !== undefined && input.group_id !== null) {
    const { data: group, error } = await ctx.supabase
      .from('screen_groups')
      .select('id')
      .eq('id', input.group_id)
      .eq('org_id', ctx.org.id)
      .maybeSingle()
    if (error) throw error
    if (!group) throw new ApiError(422, 'Unknown group')
  }

  const patch: {
    name?: string
    rotation?: number
    orientation?: string
    watermark_x?: number | null
    watermark_y?: number | null
    group_id?: string | null
    locked?: boolean
    sync?: boolean
    sync_started_at?: string | null
  } = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.sync !== undefined) {
    patch.sync = input.sync
    // Turning sync on starts the loop from 0:00 now; turning it off clears the starting line (§21).
    if (input.sync !== current.sync) patch.sync_started_at = input.sync ? new Date().toISOString() : null
  }
  if (input.rotation !== undefined) patch.rotation = input.rotation
  if (input.orientation !== undefined) patch.orientation = input.orientation
  if (input.watermark !== undefined) {
    // The badge is MTech's mark — only staff move it (§18).
    if (!ctx.profile.is_super_admin) throw new ApiError(403, 'Only MTech staff can position the watermark')
    patch.watermark_x = input.watermark?.x ?? null
    patch.watermark_y = input.watermark?.y ?? null
  }
  if (input.group_id !== undefined) patch.group_id = input.group_id
  if (input.locked !== undefined) patch.locked = input.locked

  const { error } = await ctx.supabase.from('screens').update(patch).eq('id', id).eq('org_id', ctx.org.id)
  if (error) throw error

  // Anything the player draws differently → bump + sync so the TV refetches its manifest.
  const rotationChanged = patch.rotation !== undefined && patch.rotation !== current.rotation
  const orientationChanged = patch.orientation !== undefined && patch.orientation !== current.orientation
  const watermarkChanged =
    input.watermark !== undefined &&
    (patch.watermark_x !== current.watermark_x || patch.watermark_y !== current.watermark_y)
  const groupChanged = patch.group_id !== undefined && patch.group_id !== current.group_id
  const syncChanged = patch.sync !== undefined && patch.sync !== current.sync
  if (rotationChanged || orientationChanged || watermarkChanged || groupChanged || syncChanged) {
    await bumpAndSyncScreens(admin, [id])
  }

  await notifyOrgChanged(ctx.org.id, 'screens', id)
  return getScreenView(ctx.supabase, ctx.org.id, id)
}

/**
 * Sync (or unsync) several TVs at once with ONE starting line, so a selection restarts its loop
 * from 0:00 together (§21). Only the org's own screens are touched; all of them are re-synced.
 */
export async function setScreensSync(
  ctx: OrgContext,
  admin: DbClient,
  ids: string[],
  sync: boolean,
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 }
  const { data, error } = await ctx.supabase
    .from('screens')
    .update({ sync, sync_started_at: sync ? new Date().toISOString() : null })
    .in('id', ids)
    .eq('org_id', ctx.org.id)
    .select('id')
  if (error) throw error
  const updated = (data ?? []).map((row) => row.id)
  if (updated.length > 0) await bumpAndSyncScreens(admin, updated)
  await notifyOrgChanged(ctx.org.id, 'screens')
  return { updated: updated.length }
}

/** Revoke token FIRST → `unpair` → delete row → delete own playlist → event → notify. */
export async function deleteScreen(ctx: OrgContext, admin: DbClient, id: string): Promise<void> {
  const screen = await getScreenView(ctx.supabase, ctx.org.id, id)

  const { error: revokeError } = await admin.from('screens').update({ device_token_hash: null }).eq('id', id)
  if (revokeError) throw revokeError
  await broadcastToScreens([id], 'unpair')

  const { error: deleteError } = await ctx.supabase.from('screens').delete().eq('id', id).eq('org_id', ctx.org.id)
  if (deleteError) throw deleteError
  if (screen.playlist_id) await deletePlaylist(admin, screen.playlist_id)

  await logEvent(ctx.supabase, { org_id: ctx.org.id, screen_id: null, type: 'screen_deleted', payload: { name: screen.name } })
  await notifyOrgChanged(ctx.org.id, 'screens', id)
}

/** 404 if not in org; broadcasts the action to the screen channel. */
export async function sendScreenAction(ctx: OrgContext, id: string, action: ScreenAction): Promise<void> {
  await getScreenView(ctx.supabase, ctx.org.id, id)
  await broadcastToScreens([id], action)
}
