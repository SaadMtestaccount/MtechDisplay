/**
 * lib/playlists.ts — SERVER ONLY. Playlist reads, item views, versioning (touchPlaylist) and
 * deletion. `savePlaylistItems` lives in lib/playlists/save.ts and is re-exported here.
 */
import { ApiError } from '@/lib/api'
import { broadcastToScreens, notifyOrgChanged } from '@/lib/broadcast'
import { logEvent } from '@/lib/events'
import { publicThumbUrl } from '@/lib/storage'
import type { PlaylistItemView, PlaylistListQuery, PlaylistView } from '@/types/api'
import type { Content, DbClient, Playlist, PlaylistItem, PlaylistKind, Screen, Website } from '@/types/db'

export { savePlaylistItems } from '@/lib/playlists/save'

export const PLAYLIST_ITEM_SELECT = '*, content(*), websites(*)' as const

export type PlaylistItemSource = PlaylistItem & { content: Content | null; websites: Website | null }

/** assigned menu (top precedence) → group playlist when grouped → the screen's own playlist. */
export async function getEffectivePlaylistId(
  client: DbClient,
  screen: Pick<Screen, 'menu_id' | 'group_id' | 'playlist_id'>,
): Promise<string | null> {
  if (screen.menu_id !== null) return screen.menu_id
  if (screen.group_id !== null) {
    const { data, error } = await client
      .from('screen_groups')
      .select('playlist_id')
      .eq('id', screen.group_id)
      .maybeSingle()
    if (error) throw error
    if (data) return data.playlist_id
  }
  return screen.playlist_id
}

export async function createPlaylist(
  client: DbClient,
  orgId: string,
  name: string,
  kind: PlaylistKind,
): Promise<Playlist> {
  const { data, error } = await client.from('playlists').insert({ org_id: orgId, name, kind }).select('*').single()
  if (error) throw error
  return data
}

export function toPlaylistItemView(item: PlaylistItemSource, now: Date = new Date()): PlaylistItemView {
  const { content, websites, ...row } = item
  const expired =
    content !== null && content.expires_at !== null && new Date(content.expires_at).getTime() < now.getTime()
  return {
    ...row,
    name: content?.name ?? websites?.name ?? 'Missing item',
    media_type: content ? content.type : 'website',
    thumb_url: content ? publicThumbUrl(content.thumb_path) : null,
    source_duration_seconds: content && content.type === 'video' ? content.duration_seconds : null,
    website_url: websites?.url ?? null,
    expired,
  }
}

export async function listPlaylists(
  supabase: DbClient,
  orgId: string,
  query: PlaylistListQuery,
): Promise<Playlist[]> {
  let q = supabase.from('playlists').select('*').eq('org_id', orgId).order('name', { ascending: true })
  if (query.kind) q = q.eq('kind', query.kind)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function listPlaylistItemViews(
  client: DbClient,
  playlistId: string,
  now: Date = new Date(),
): Promise<PlaylistItemView[]> {
  const { data, error } = await client
    .from('playlist_items')
    .select(PLAYLIST_ITEM_SELECT)
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true })
  if (error) throw error
  return data.map((item) => toPlaylistItemView(item, now))
}

/** 404 when the playlist is not in the org; items ordered by position. */
export async function getPlaylistView(supabase: DbClient, orgId: string, playlistId: string): Promise<PlaylistView> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'Playlist not found')
  const items = await listPlaylistItemViews(supabase, playlistId)
  return { ...data, items }
}

/**
 * Bumps updated_at + every affected screen's playlist_version, broadcasts `sync`, logs
 * `playlist_updated` and notifies admin tabs. Returns the affected screen ids.
 */
export async function touchPlaylist(admin: DbClient, playlistId: string): Promise<string[]> {
  const { data: ids, error } = await admin.rpc('bump_playlist_version', { p_playlist_id: playlistId })
  if (error) throw error
  const screenIds = ids ?? []

  const { data: playlist } = await admin.from('playlists').select('org_id').eq('id', playlistId).maybeSingle()

  await broadcastToScreens(screenIds, 'sync')
  if (playlist) {
    await logEvent(admin, {
      org_id: playlist.org_id,
      type: 'playlist_updated',
      payload: { playlist_id: playlistId, screen_ids: screenIds },
    })
    await notifyOrgChanged(playlist.org_id, 'playlists', playlistId)
    await notifyOrgChanged(playlist.org_id, 'screens')
  }
  return screenIds
}

/** Deletes a playlist (items cascade; a group playlist cascades to its group; screens.playlist_id → null). */
export async function deletePlaylist(client: DbClient, playlistId: string): Promise<void> {
  const { error } = await client.from('playlists').delete().eq('id', playlistId)
  if (error) throw error
}
