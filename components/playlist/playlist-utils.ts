/**
 * components/playlist/playlist-utils.ts — client helpers for the playlist editor, no React
 * (docs/CONTRACTS.md §9.5). The exporting module for the shared editor types: `LibraryPick`
 * (LibraryPanel/LibraryCard/PlaylistEditor), the PlaylistItemView → PlaylistItemInput
 * projection (also the autosave dirty comparison) and the factory for rows appended from
 * the library.
 */
import type { PlaylistItemInput } from '@/lib/validators/playlists'
import type { ContentView, PlaylistItemView, WebsiteView } from '@/types/api'

export type LibraryPick =
  | { kind: 'content'; content: ContentView }
  | { kind: 'website'; website: WebsiteView }

/** Draggable id for a library card: `lib:{content|website}:{id}` (docs/CONTRACTS.md §9.5). */
export function libraryDragId(pick: LibraryPick): string {
  return pick.kind === 'content' ? `lib:content:${pick.content.id}` : `lib:website:${pick.website.id}`
}

/** Full ordered list sent to PUT /api/playlists/[id]/items; `position` is the array index (server side). */
export function toPlaylistItemInput(items: PlaylistItemView[]): PlaylistItemInput[] {
  return items.map((item) => ({
    id: item.id,
    item_type: item.item_type,
    content_id: item.content_id,
    website_id: item.website_id,
    duration_seconds: item.duration_seconds,
    transition: item.transition,
    mute: item.mute,
    active_from: item.active_from,
    active_to: item.active_to,
    days_of_week: item.days_of_week,
    daily_start: item.daily_start,
    daily_end: item.daily_end,
  }))
}

/**
 * New row appended from a library pick. The id is client-generated (admin pages run in a
 * secure context) and stays stable across saves; `created_at` is a placeholder the server
 * row replaces after the first save.
 */
export function newItemFromPick(pick: LibraryPick, playlistId: string, position: number): PlaylistItemView {
  const base = {
    id: crypto.randomUUID(),
    playlist_id: playlistId,
    position,
    duration_seconds: null,
    transition: 'fade' as const,
    mute: true,
    active_from: null,
    active_to: null,
    days_of_week: null,
    daily_start: null,
    daily_end: null,
    created_at: new Date().toISOString(),
  }
  if (pick.kind === 'content') {
    return {
      ...base,
      item_type: 'content',
      content_id: pick.content.id,
      website_id: null,
      name: pick.content.name,
      media_type: pick.content.type,
      thumb_url: pick.content.thumb_url,
      source_duration_seconds: pick.content.type === 'video' ? pick.content.duration_seconds : null,
      website_url: null,
      expired: pick.content.expired,
    }
  }
  return {
    ...base,
    item_type: 'website',
    content_id: null,
    website_id: pick.website.id,
    name: pick.website.name,
    media_type: 'website',
    thumb_url: null,
    source_duration_seconds: null,
    website_url: pick.website.url,
    expired: false,
  }
}
