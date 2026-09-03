/**
 * lib/playlists/save.ts — SERVER ONLY. Full-list save of playlist items (PUT /api/playlists/[id]/items).
 * Re-exported by lib/playlists.ts as `savePlaylistItems`.
 */
import { ApiError } from '@/lib/api'
import type { OrgContext } from '@/lib/auth'
import { getPlaylistView, touchPlaylist } from '@/lib/playlists'
import type { PlaylistItemInput } from '@/lib/validators/playlists'
import type { PlaylistView } from '@/types/api'
import type { DbClient, TablesInsert } from '@/types/db'

async function assertOrgOwns(
  supabase: DbClient,
  table: 'content' | 'websites',
  orgId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return
  const { data, error } = await supabase.from(table).select('id').eq('org_id', orgId).in('id', ids)
  if (error) throw error
  const found = new Set(data.map((r) => r.id))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new ApiError(422, table === 'content' ? 'Unknown content in playlist' : 'Unknown website in playlist')
  }
}

function toRow(playlistId: string, item: PlaylistItemInput, position: number): TablesInsert<'playlist_items'> {
  return {
    id: item.id,
    playlist_id: playlistId,
    position,
    item_type: item.item_type,
    content_id: item.item_type === 'content' ? item.content_id : null,
    website_id: item.item_type === 'website' ? item.website_id : null,
    duration_seconds: item.duration_seconds,
    transition: item.transition,
    mute: item.mute,
    active_from: item.active_from,
    active_to: item.active_to,
    days_of_week: item.days_of_week,
    daily_start: item.daily_start,
    daily_end: item.daily_end,
  }
}

export async function savePlaylistItems(
  ctx: OrgContext,
  admin: DbClient,
  playlistId: string,
  items: PlaylistItemInput[],
): Promise<PlaylistView> {
  const { supabase, org } = ctx

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('org_id', org.id)
    .maybeSingle()
  if (playlistError) throw playlistError
  if (!playlist) throw new ApiError(404, 'Playlist not found')

  const contentIds = Array.from(new Set(items.flatMap((i) => (i.content_id ? [i.content_id] : []))))
  const websiteIds = Array.from(new Set(items.flatMap((i) => (i.website_id ? [i.website_id] : []))))
  await assertOrgOwns(supabase, 'content', org.id, contentIds)
  await assertOrgOwns(supabase, 'websites', org.id, websiteIds)

  const { data: existing, error: existingError } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', playlistId)
  if (existingError) throw existingError

  const keep = new Set(items.map((i) => i.id))
  const toDelete = existing.map((r) => r.id).filter((id) => !keep.has(id))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('playlist_items').delete().eq('playlist_id', playlistId).in('id', toDelete)
    if (error) throw error
  }

  if (items.length > 0) {
    const rows = items.map((item, index) => toRow(playlistId, item, index))
    const { error } = await supabase.from('playlist_items').upsert(rows, { onConflict: 'id' })
    if (error) throw error
  }

  await touchPlaylist(admin, playlistId)
  return getPlaylistView(supabase, org.id, playlistId)
}
