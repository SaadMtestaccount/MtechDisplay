/**
 * lib/manifest.ts — SERVER ONLY. Builds the player manifest from a screen's effective playlist.
 * Media URLs are signed in one batched call (24h). Schedules are NOT evaluated here.
 */
import { ApiError } from '@/lib/api'
import { getEffectivePlaylistId } from '@/lib/playlists'
import { DEVICE_SIGNED_URL_TTL_SECONDS, createMediaSignedUrls, publicThumbUrl } from '@/lib/storage'
import { isOrientation, isRotation } from '@/lib/utils'
import {
  DEFAULT_ITEM_DURATION_SECONDS, type Manifest, type ManifestItem, type Orientation, type Rotation,
} from '@/types/api'
import type { Content, DbClient, PlaylistItem, Screen, Website } from '@/types/db'

type ItemSource = PlaylistItem & { content: Content | null; websites: Website | null }

/**
 * override ?? (video ? detected, to 10 ms : null) ?? DEFAULT_ITEM_DURATION_SECONDS. Video durations
 * are kept exact (not rounded up) so synced playback slots match the file and TVs don't sit on a
 * finished frame waiting for the boundary (§21).
 */
export function resolveDuration(item: PlaylistItem, content: Content | null): number {
  if (item.duration_seconds !== null && item.duration_seconds > 0) return item.duration_seconds
  if (content && content.type === 'video' && content.duration_seconds !== null && content.duration_seconds > 0) {
    return Math.max(1, Math.round(content.duration_seconds * 100) / 100)
  }
  return DEFAULT_ITEM_DURATION_SECONDS
}

function scheduleOf(item: PlaylistItem): ManifestItem['schedule'] {
  return {
    active_from: item.active_from,
    active_to: item.active_to,
    days_of_week: item.days_of_week,
    daily_start: item.daily_start,
    daily_end: item.daily_end,
  }
}

function toManifestItem(item: ItemSource, urls: Map<string, string>): ManifestItem | null {
  if (item.content) {
    const url = urls.get(item.content.storage_path)
    if (!url) {
      console.warn('[manifest] no signed URL for', item.content.storage_path)
      return null
    }
    return {
      id: item.id,
      type: item.content.type,
      content_id: item.content.id,
      url,
      thumb: publicThumbUrl(item.content.thumb_path),
      name: item.content.name,
      duration_seconds: resolveDuration(item, item.content),
      transition: item.transition,
      mute: item.mute,
      refresh_seconds: 0,
      expires_at: item.content.expires_at,
      schedule: scheduleOf(item),
    }
  }
  if (item.websites) {
    return {
      id: item.id,
      type: 'website',
      content_id: null,
      url: item.websites.url,
      thumb: null,
      name: item.websites.name,
      duration_seconds: resolveDuration(item, null),
      transition: item.transition,
      mute: item.mute,
      refresh_seconds: item.websites.refresh_seconds,
      expires_at: null,
      schedule: scheduleOf(item),
    }
  }
  return null
}

async function loadItems(admin: DbClient, playlistId: string | null, now: Date): Promise<ItemSource[]> {
  if (playlistId === null) return []
  const { data, error } = await admin
    .from('playlist_items')
    .select('*, content(*), websites(*)')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true })
  if (error) throw new ApiError(500, error.message)
  const nowMs = now.getTime()
  return data.filter((item) => {
    if (item.content) {
      return item.content.expires_at === null || new Date(item.content.expires_at).getTime() >= nowMs
    }
    return item.websites !== null
  })
}

export async function buildManifest(admin: DbClient, screen: Screen): Promise<Manifest> {
  const now = new Date()
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('name, logo_url, timezone')
    .eq('id', screen.org_id)
    .single()
  if (orgError || !org) throw new ApiError(500, orgError?.message ?? 'Organization not found')

  const effective = await getEffectivePlaylistId(admin, screen)
  const items = await loadItems(admin, effective, now)
  // Synced playback when the TV itself is flagged (TVs page selection) OR its playlist is (§21);
  // the starting line comes from whichever flag applies.
  let sync = screen.sync
  let syncEpoch: string | null = screen.sync ? screen.sync_started_at : null
  if (!sync && effective !== null) {
    const { data: playlist } = await admin
      .from('playlists')
      .select('sync, sync_started_at')
      .eq('id', effective)
      .maybeSingle()
    sync = playlist?.sync ?? false
    syncEpoch = sync ? (playlist?.sync_started_at ?? null) : null
  }

  const mediaKeys = items.flatMap((i) => (i.content ? [i.content.storage_path] : []))
  const urls = await createMediaSignedUrls(admin, mediaKeys, DEVICE_SIGNED_URL_TTL_SECONDS)

  const rotation: Rotation = isRotation(screen.rotation) ? screen.rotation : 0
  const orientation: Orientation = isOrientation(screen.orientation) ? screen.orientation : 'landscape'
  const watermark =
    screen.watermark_x !== null && screen.watermark_y !== null
      ? { x: screen.watermark_x, y: screen.watermark_y }
      : null

  return {
    screen: { id: screen.id, name: screen.name, rotation, orientation, watermark, timezone: org.timezone },
    org: { name: org.name, logo_url: org.logo_url },
    playlist_version: screen.playlist_version,
    sync,
    sync_epoch: syncEpoch,
    generated_at: now.toISOString(),
    items: items.flatMap((item) => {
      const mapped = toManifestItem(item, urls)
      return mapped ? [mapped] : []
    }),
  }
}
