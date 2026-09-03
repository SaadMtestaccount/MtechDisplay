/**
 * lib/player/media-cache.ts — Cache Storage helpers for the player (docs/CONTRACTS.md §10).
 * One mechanism for images AND videos (decision §0.14): entries are keyed by content id
 * (`/__msign/media/{content_id}`), never by the rotating signed URL. Insecure contexts
 * without the Cache API degrade to `null` — the player then plays signed URLs directly.
 */
import type { ManifestItem } from '@/types/api'

export const CACHE_NAME = 'msign-media-v1'
/** Items above this size get object URLs only while offline (§8 useMediaCache). */
export const LARGE_MEDIA_BYTES = 64 * 1024 * 1024

const KEY_PREFIX = '/__msign/media/'

export function cacheKeyFor(contentId: string): string {
  return `${KEY_PREFIX}${contentId}`
}

export async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

async function responseBytes(cache: Cache, key: string, response: Response): Promise<number> {
  const header = response.headers.get('content-length')
  const fromHeader = header === null ? NaN : Number(header)
  if (Number.isFinite(fromHeader) && fromHeader > 0) return fromHeader
  const stored = await cache.match(key)
  if (!stored) return 0
  const blob = await stored.blob()
  return blob.size
}

/**
 * Ensures the item's media is in Cache Storage; returns its size in bytes, or `null`
 * when the Cache API is unavailable or the item has no content id (websites).
 * Throws on a failed download so callers can log and retry later.
 */
export async function cacheMedia(item: ManifestItem): Promise<number | null> {
  if (!item.content_id) return null
  const cache = await openCache()
  if (!cache) return null
  const key = cacheKeyFor(item.content_id)
  const existing = await cache.match(key)
  if (existing) return responseBytes(cache, key, existing)
  const response = await fetch(item.url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Media download failed (${response.status}) for ${item.name}`)
  await cache.put(key, response)
  const stored = await cache.match(key)
  if (!stored) throw new Error(`Cache write failed for ${item.name}`)
  return responseBytes(cache, key, stored)
}

/** Object URL for a cached item's blob; null when not cached / no Cache API. */
export async function getCachedBlobUrl(contentId: string): Promise<string | null> {
  const cache = await openCache()
  if (!cache) return null
  const stored = await cache.match(cacheKeyFor(contentId))
  if (!stored) return null
  try {
    const blob = await stored.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/** Drops every cached entry whose content id is not in `contentIds` (after each manifest). */
export async function evictExcept(contentIds: string[]): Promise<string[]> {
  const cache = await openCache()
  if (!cache) return []
  const keep = new Set(contentIds.map((id) => cacheKeyFor(id)))
  const evicted: string[] = []
  try {
    for (const request of await cache.keys()) {
      const pathname = new URL(request.url).pathname
      if (!pathname.startsWith(KEY_PREFIX) || keep.has(pathname)) continue
      await cache.delete(request)
      evicted.push(pathname.slice(KEY_PREFIX.length))
    }
  } catch (e) {
    console.warn('[player] cache eviction failed', e)
  }
  return evicted
}

/** Wipes the whole media cache (unpair path, §10). Best effort. */
export async function deleteMediaCache(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return
    await caches.delete(CACHE_NAME)
  } catch {
    // ignore
  }
}
