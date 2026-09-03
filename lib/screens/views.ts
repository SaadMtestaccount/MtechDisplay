/**
 * lib/screens/views.ts — SERVER ONLY. List / detail reads returning ScreenView / ScreenDetailView.
 */
import { ApiError } from '@/lib/api'
import { createPlaylist, getPlaylistView } from '@/lib/playlists'
import { asScreenSources, screenQuery, toScreenView, type ScreenSource } from '@/lib/screens/select'
import { escapeLike } from '@/lib/utils'
import type { ScreenDetailView, ScreenListQuery, ScreenView } from '@/types/api'
import type { DbClient } from '@/types/db'

export async function fetchScreenSource(client: DbClient, orgId: string, id: string): Promise<ScreenSource> {
  const { data, error } = await screenQuery(client).eq('id', id).eq('org_id', orgId).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Screen not found')
  return data
}

export async function listScreens(supabase: DbClient, orgId: string, query: ScreenListQuery): Promise<ScreenView[]> {
  let q = screenQuery(supabase).eq('org_id', orgId)
  if (query.q) q = q.ilike('name', `%${escapeLike(query.q)}%`)
  if (query.group_id === 'none') q = q.is('group_id', null)
  else if (query.group_id) q = q.eq('group_id', query.group_id)

  const dir = query.dir
  switch (query.sort) {
    case 'last_seen':
      q = q.order('last_seen_at', { ascending: dir === 'asc', nullsFirst: false }).order('name', { ascending: true })
      break
    case 'newest':
      q = q.order('created_at', { ascending: dir === 'asc' })
      break
    case 'name':
    default:
      q = q.order('name', { ascending: dir !== 'desc' })
      break
  }

  const { data, error } = await q
  if (error) throw error
  const now = new Date()
  const views = asScreenSources(data).map((row) => toScreenView(row, now))
  if (query.status === 'online') return views.filter((s) => s.online)
  if (query.status === 'offline') return views.filter((s) => !s.online)
  return views
}

export async function getScreenView(supabase: DbClient, orgId: string, id: string): Promise<ScreenView> {
  return toScreenView(await fetchScreenSource(supabase, orgId, id))
}

/** Self-heals a screen with no playlist and no group by creating its own playlist. */
export async function getScreenDetail(supabase: DbClient, orgId: string, id: string): Promise<ScreenDetailView> {
  let source = await fetchScreenSource(supabase, orgId, id)
  if (source.playlist_id === null && source.group_id === null) {
    const playlist = await createPlaylist(supabase, orgId, source.name, 'screen')
    const { error } = await supabase.from('screens').update({ playlist_id: playlist.id }).eq('id', id)
    if (error) throw error
    source = await fetchScreenSource(supabase, orgId, id)
  }
  const view = toScreenView(source)
  const playlist = view.effective_playlist_id ? await getPlaylistView(supabase, orgId, view.effective_playlist_id) : null
  const group =
    source.group_id !== null && source.screen_groups
      ? { id: source.group_id, name: source.screen_groups.name, playlist_id: source.screen_groups.playlist_id }
      : null
  return { ...view, playlist, group }
}
