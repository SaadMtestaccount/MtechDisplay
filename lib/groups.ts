/**
 * lib/groups.ts — SERVER ONLY. Screen groups: CRUD + membership diff (docs/CONTRACTS.md §5.20).
 */
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { notifyOrgChanged } from '@/lib/broadcast'
import { createPlaylist, deletePlaylist, getPlaylistView } from '@/lib/playlists'
import { SCREEN_SELECT, bumpAndSyncScreens, toScreenView } from '@/lib/screens'
import { isOnline } from '@/lib/status'
import { escapeLike } from '@/lib/utils'
import type { GroupInput } from '@/lib/validators/groups'
import type { GroupDetailView, GroupListQuery, GroupView } from '@/types/api'
import type { DbClient, ScreenGroup } from '@/types/db'

const GROUP_SELECT = '*, screens(id, last_seen_at, device_token_hash)' as const

type GroupSource = ScreenGroup & { screens: { id: string; last_seen_at: string | null; device_token_hash: string | null }[] }

function toGroupView(row: GroupSource, now: Date): GroupView {
  const { screens, ...group } = row
  const online = screens.filter((s) => isOnline(s.last_seen_at, now)).length
  return { ...group, screen_count: screens.length, online_count: online, offline_count: screens.length - online }
}

async function fetchGroupSource(supabase: DbClient, orgId: string, id: string): Promise<GroupSource> {
  const { data, error } = await supabase.from('screen_groups').select(GROUP_SELECT).eq('id', id).eq('org_id', orgId).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Group not found')
  return data
}

export async function listGroups(supabase: DbClient, orgId: string, query: GroupListQuery): Promise<GroupView[]> {
  let q = supabase.from('screen_groups').select(GROUP_SELECT).eq('org_id', orgId)
  if (query.q) q = q.ilike('name', `%${escapeLike(query.q)}%`)
  if (query.sort === 'newest') q = q.order('created_at', { ascending: query.dir === 'asc' })
  else q = q.order('name', { ascending: query.dir !== 'desc' })
  const { data, error } = await q
  if (error) throw error
  const now = new Date()
  return data.map((row) => toGroupView(row, now))
}

export async function getGroupDetail(supabase: DbClient, orgId: string, id: string): Promise<GroupDetailView> {
  const now = new Date()
  const group = toGroupView(await fetchGroupSource(supabase, orgId, id), now)
  const { data, error } = await supabase
    .from('screens')
    .select(SCREEN_SELECT)
    .eq('org_id', orgId)
    .eq('group_id', id)
    .order('name', { ascending: true })
  if (error) throw error
  const screens = data.map((row) => toScreenView(row, now))
  const playlist = await getPlaylistView(supabase, orgId, group.playlist_id)
  return { ...group, screens, playlist }
}

export async function createGroup(ctx: OrgContext, input: GroupInput): Promise<GroupView> {
  const playlist = await createPlaylist(ctx.supabase, ctx.org.id, input.name, 'group')
  const { data, error } = await ctx.supabase
    .from('screen_groups')
    .insert({ org_id: ctx.org.id, name: input.name, playlist_id: playlist.id })
    .select('*')
    .single()
  if (error) {
    await deletePlaylist(ctx.supabase, playlist.id).catch((e: unknown) => console.error('[groups] cleanup', e))
    throw error
  }
  await notifyOrgChanged(ctx.org.id, 'groups', data.id)
  return { ...data, screen_count: 0, online_count: 0, offline_count: 0 }
}

/** Rename (also renames the group's playlist). */
export async function updateGroup(ctx: OrgContext, id: string, input: GroupInput): Promise<GroupView> {
  const existing = await fetchGroupSource(ctx.supabase, ctx.org.id, id)
  const { error } = await ctx.supabase.from('screen_groups').update({ name: input.name }).eq('id', id).eq('org_id', ctx.org.id)
  if (error) throw error
  const { error: playlistError } = await ctx.supabase.from('playlists').update({ name: input.name }).eq('id', existing.playlist_id)
  if (playlistError) throw playlistError
  await notifyOrgChanged(ctx.org.id, 'groups', id)
  return toGroupView(await fetchGroupSource(ctx.supabase, ctx.org.id, id), new Date())
}

/** Members revert to their own playlists (group_id → null, bump + sync), then group and playlist go. */
export async function deleteGroup(ctx: OrgContext, admin: DbClient, id: string): Promise<void> {
  const group = await fetchGroupSource(ctx.supabase, ctx.org.id, id)
  const memberIds = group.screens.map((s) => s.id)
  if (memberIds.length > 0) {
    const { error } = await ctx.supabase.from('screens').update({ group_id: null }).eq('group_id', id)
    if (error) throw error
    await bumpAndSyncScreens(admin, memberIds)
  }
  const { error: deleteError } = await ctx.supabase.from('screen_groups').delete().eq('id', id).eq('org_id', ctx.org.id)
  if (deleteError) throw deleteError
  await deletePlaylist(admin, group.playlist_id)
  await notifyOrgChanged(ctx.org.id, 'groups', id)
  await notifyOrgChanged(ctx.org.id, 'screens')
}

export async function setGroupScreens(
  ctx: OrgContext,
  admin: DbClient,
  id: string,
  screenIds: string[],
): Promise<GroupDetailView> {
  const group = await fetchGroupSource(ctx.supabase, ctx.org.id, id)
  const target = Array.from(new Set(screenIds))

  if (target.length > 0) {
    const { data, error } = await ctx.supabase.from('screens').select('id').eq('org_id', ctx.org.id).in('id', target)
    if (error) throw error
    if (data.length !== target.length) throw new ApiError(422, 'Unknown screen')
  }

  const current = new Set(group.screens.map((s) => s.id))
  const targetSet = new Set(target)
  const remove = Array.from(current).filter((sid) => !targetSet.has(sid))
  const add = target.filter((sid) => !current.has(sid))

  if (remove.length > 0) {
    const { error } = await ctx.supabase.from('screens').update({ group_id: null }).eq('group_id', id).in('id', remove)
    if (error) throw error
  }
  if (add.length > 0) {
    const { error } = await ctx.supabase.from('screens').update({ group_id: id }).eq('org_id', ctx.org.id).in('id', add)
    if (error) throw error
  }

  await bumpAndSyncScreens(admin, [...add, ...remove])
  await notifyOrgChanged(ctx.org.id, 'groups', id)
  await notifyOrgChanged(ctx.org.id, 'screens')
  return getGroupDetail(ctx.supabase, ctx.org.id, id)
}
