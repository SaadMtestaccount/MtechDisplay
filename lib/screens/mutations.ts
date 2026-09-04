/**
 * lib/screens/mutations.ts — SERVER ONLY. Claim / update / delete / actions / version bumps.
 */
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { broadcastToScreens, notifyOrgChanged } from '@/lib/broadcast'
import { logEvent } from '@/lib/events'
import { createPlaylist, deletePlaylist } from '@/lib/playlists'
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

  const patch: { name?: string; rotation?: number; group_id?: string | null; locked?: boolean } = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.rotation !== undefined) patch.rotation = input.rotation
  if (input.group_id !== undefined) patch.group_id = input.group_id
  if (input.locked !== undefined) patch.locked = input.locked

  const { error } = await ctx.supabase.from('screens').update(patch).eq('id', id).eq('org_id', ctx.org.id)
  if (error) throw error

  const rotationChanged = patch.rotation !== undefined && patch.rotation !== current.rotation
  const groupChanged = patch.group_id !== undefined && patch.group_id !== current.group_id
  if (rotationChanged || groupChanged) await bumpAndSyncScreens(admin, [id])

  await notifyOrgChanged(ctx.org.id, 'screens', id)
  return getScreenView(ctx.supabase, ctx.org.id, id)
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
