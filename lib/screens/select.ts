/**
 * lib/screens/select.ts — the screens select literal, its parsed row type and the view mapper.
 * SERVER ONLY (imported through lib/screens.ts).
 */
import { isOnline } from '@/lib/status'
import { publicThumbUrl } from '@/lib/storage'
import type { CurrentItemView, ScreenView } from '@/types/api'
import type { Content, DbClient, PlaylistItem, Screen, Website } from '@/types/db'

export const SCREEN_SELECT =
  '*, screen_groups(name, playlist_id), menu:playlists!screens_menu_id_fkey(id, name), current_item:playlist_items!screens_current_item_id_fkey(*, content(*), websites(*))' as const

export type ScreenSource = Screen & {
  screen_groups: { name: string; playlist_id: string } | null
  menu: { id: string; name: string } | null
  current_item: (PlaylistItem & { content: Content | null; websites: Website | null }) | null
}

/** Base query — its parsed row type must equal ScreenSource (checked in `asScreenSources`). */
export function screenQuery(client: DbClient) {
  return client.from('screens').select(SCREEN_SELECT)
}

/** Compile-time proof that the select literal parses to ScreenSource (no casts). */
export function asScreenSources(rows: NonNullable<Awaited<ReturnType<typeof screenQuery>>['data']>): ScreenSource[] {
  return rows
}

function toCurrentItem(item: ScreenSource['current_item']): CurrentItemView | null {
  if (!item) return null
  if (item.content) {
    return {
      id: item.id,
      name: item.content.name,
      thumb_url: publicThumbUrl(item.content.thumb_path),
      item_type: 'content',
      media_type: item.content.type,
      website_url: null,
    }
  }
  if (item.websites) {
    return {
      id: item.id,
      name: item.websites.name,
      thumb_url: null,
      item_type: 'website',
      media_type: 'website',
      website_url: item.websites.url,
    }
  }
  return null
}

export function toScreenView(row: ScreenSource, now: Date = new Date()): ScreenView {
  const { device_token_hash, screen_groups, menu, current_item, ...screen } = row
  return {
    ...screen,
    paired: device_token_hash !== null,
    online: isOnline(screen.last_seen_at, now),
    group_name: screen_groups?.name ?? null,
    menu_name: menu?.name ?? null,
    // menu (top precedence) → group playlist → own playlist, matching getEffectivePlaylistId.
    effective_playlist_id: menu?.id ?? screen_groups?.playlist_id ?? screen.playlist_id,
    current_item: toCurrentItem(current_item),
    // Filled by attachScreenPreviews (a batch query); null until then.
    preview_thumb_url: null,
    preview_website_url: null,
  }
}

/**
 * Fills preview_thumb_url / preview_website_url from the first board of each screen's EFFECTIVE
 * playlist, so tiles show what a screen is set to display even when no live item is reported.
 * One batched query for the whole list.
 */
export async function attachScreenPreviews(client: DbClient, views: ScreenView[]): Promise<void> {
  const ids = Array.from(
    new Set(views.map((v) => v.effective_playlist_id).filter((id): id is string => id !== null)),
  )
  if (ids.length === 0) return
  const { data, error } = await client
    .from('playlist_items')
    .select('playlist_id, content(thumb_path), websites(url)')
    .in('playlist_id', ids)
    .order('position', { ascending: true })
  if (error) throw error
  const first = new Map<string, { thumb: string | null; url: string | null }>()
  for (const item of data ?? []) {
    if (first.has(item.playlist_id)) continue
    first.set(item.playlist_id, {
      thumb: item.content ? publicThumbUrl(item.content.thumb_path) : null,
      url: item.websites?.url ?? null,
    })
  }
  for (const view of views) {
    const f = view.effective_playlist_id ? first.get(view.effective_playlist_id) : undefined
    view.preview_thumb_url = f?.thumb ?? null
    view.preview_website_url = f?.url ?? null
  }
}
