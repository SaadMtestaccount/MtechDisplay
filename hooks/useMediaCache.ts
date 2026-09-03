'use client'

/**
 * hooks/useMediaCache.ts — preloads manifest media, images AND videos alike (decision
 * §0.14), into Cache Storage keyed by content id, in manifest order, evicting entries no
 * longer referenced. `srcFor(item)`: object URL when held → signed URL while online →
 * null (the engine skips). Object URLs are kept for cached items ≤ LARGE_MEDIA_BYTES;
 * larger ones get one only while offline (created when `offline` flips true, revoked when
 * it flips false — large videos play from their signed URLs while online). Without the
 * Cache API (insecure context) everything plays from signed URLs directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cacheMedia, evictExcept, getCachedBlobUrl, LARGE_MEDIA_BYTES } from '@/lib/player/media-cache'
import type { Manifest, ManifestItem } from '@/types/api'

function safeRevoke(url: string): void {
  try {
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

export function useMediaCache(manifest: Manifest | null, offline: boolean): {
  readyIds: Set<string>
  isReady(itemId: string): boolean
  srcFor(item: ManifestItem): string | null
  progress: { done: number; total: number }
} {
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set())
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const bytesRef = useRef(new Map<string, number>())
  const urlsRef = useRef<Record<string, string>>({})
  const offlineRef = useRef(offline)
  offlineRef.current = offline

  const setUrl = useCallback((contentId: string, url: string) => {
    urlsRef.current = { ...urlsRef.current, [contentId]: url }
    setObjectUrls(urlsRef.current)
  }, [])

  const revokeUrl = useCallback((contentId: string) => {
    const url = urlsRef.current[contentId]
    if (!url) return
    safeRevoke(url)
    const next = { ...urlsRef.current }
    delete next[contentId]
    urlsRef.current = next
    setObjectUrls(next)
  }, [])

  // Preload every media item in manifest order; evict entries not in the manifest.
  useEffect(() => {
    if (!manifest) {
      // Unpaired (wipe deleted the cache bucket): release object URLs and reset.
      for (const url of Object.values(urlsRef.current)) safeRevoke(url)
      urlsRef.current = {}
      setObjectUrls({})
      bytesRef.current.clear()
      setCachedIds((prev) => (prev.size > 0 ? new Set<string>() : prev))
      setProgress({ done: 0, total: 0 })
      return
    }
    let cancelled = false

    const mediaItems: ManifestItem[] = []
    const keepIds = new Set<string>()
    for (const item of manifest.items) {
      if (item.type === 'website' || !item.content_id || keepIds.has(item.content_id)) continue
      keepIds.add(item.content_id)
      mediaItems.push(item)
    }
    setProgress({ done: 0, total: mediaItems.length })

    void (async () => {
      const evicted = await evictExcept([...keepIds])
      if (cancelled) return
      if (evicted.length > 0) {
        for (const contentId of evicted) {
          bytesRef.current.delete(contentId)
          revokeUrl(contentId)
        }
        setCachedIds((prev) => {
          const next = new Set(prev)
          let changed = false
          for (const contentId of evicted) changed = next.delete(contentId) || changed
          return changed ? next : prev
        })
      }

      let done = 0
      for (const item of mediaItems) {
        if (cancelled) return
        const contentId = item.content_id
        if (contentId) {
          try {
            const bytes = await cacheMedia(item)
            if (cancelled) return
            if (bytes !== null) {
              bytesRef.current.set(contentId, bytes)
              setCachedIds((prev) => (prev.has(contentId) ? prev : new Set(prev).add(contentId)))
              const wantsUrl = bytes <= LARGE_MEDIA_BYTES || offlineRef.current
              if (wantsUrl && !urlsRef.current[contentId]) {
                const url = await getCachedBlobUrl(contentId)
                if (cancelled) {
                  if (url) safeRevoke(url)
                  return
                }
                if (url) setUrl(contentId, url)
              }
            }
          } catch (e) {
            console.warn('[player] media preload failed', item.name, e)
          }
        }
        done += 1
        setProgress({ done, total: mediaItems.length })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [manifest, revokeUrl, setUrl])

  // Offline flips: large cached items get object URLs only while offline (§8).
  useEffect(() => {
    if (offline) {
      let cancelled = false
      void (async () => {
        for (const [contentId, bytes] of [...bytesRef.current]) {
          if (cancelled) return
          if (bytes <= LARGE_MEDIA_BYTES || urlsRef.current[contentId]) continue
          const url = await getCachedBlobUrl(contentId)
          if (cancelled) {
            if (url) safeRevoke(url)
            return
          }
          if (url) setUrl(contentId, url)
        }
      })()
      return () => {
        cancelled = true
      }
    }
    for (const [contentId, bytes] of [...bytesRef.current]) {
      if (bytes > LARGE_MEDIA_BYTES) revokeUrl(contentId)
    }
    return undefined
  }, [offline, revokeUrl, setUrl])

  // Revoke everything on unmount.
  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) safeRevoke(url)
      urlsRef.current = {}
    },
    [],
  )

  const readyIds = useMemo(() => {
    const ready = new Set<string>()
    if (!manifest) return ready
    for (const item of manifest.items) {
      if (item.type === 'website') ready.add(item.id)
      else if (item.content_id && cachedIds.has(item.content_id)) ready.add(item.id)
    }
    return ready
  }, [manifest, cachedIds])

  const isReady = useCallback((itemId: string) => readyIds.has(itemId), [readyIds])

  const srcFor = useCallback(
    (item: ManifestItem): string | null => {
      if (item.type === 'website') return item.url
      const url = item.content_id ? objectUrls[item.content_id] : undefined
      if (url) return url
      return offline ? null : item.url
    },
    [objectUrls, offline],
  )

  return useMemo(
    () => ({ readyIds, isReady, srcFor, progress }),
    [readyIds, isReady, srcFor, progress],
  )
}
