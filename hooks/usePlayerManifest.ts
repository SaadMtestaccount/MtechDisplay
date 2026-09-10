'use client'

/**
 * hooks/usePlayerManifest.ts — the player's manifest loader (docs/CONTRACTS.md §8, §10).
 * Renders the last good manifest from localStorage (`msign.manifest`) immediately, then
 * fetches fresh. Concurrent refetch() calls share one in-flight request; failures retry
 * with nextDelay backoff (5s→60s) and report status 'offline'; a 60s timer refetches
 * whenever generated_at is older than MANIFEST_MAX_AGE_MS (signed URLs last 24h).
 * A 401 calls onUnauthorized (the app wipes and returns to pairing).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { nextDelay } from '@/lib/player/backoff'
import { noteServerTime } from '@/lib/player/clock'
import { DeviceApiError, fetchManifest } from '@/lib/player/device-api'
import { isManifest } from '@/lib/player/playback'
import { MANIFEST_KEY, readJson, writeJson } from '@/lib/player/player-storage'
import type { Manifest } from '@/types/api'

/** Manifests older than this are refreshed even without a sync (12h; URLs last 24h). */
export const MANIFEST_MAX_AGE_MS = 12 * 3_600_000

const MAX_AGE_CHECK_MS = 60_000

type ManifestStatus = 'idle' | 'loading' | 'ready' | 'offline'

export function usePlayerManifest(opts: { deviceToken: string | null; onUnauthorized(): void }): {
  manifest: Manifest | null
  status: ManifestStatus
  refetch(): Promise<void>
  lastFetchedAt: Date | null
} {
  const { deviceToken } = opts
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [status, setStatus] = useState<ManifestStatus>('idle')
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)

  const onUnauthorizedRef = useRef(opts.onUnauthorized)
  onUnauthorizedRef.current = opts.onUnauthorized
  const tokenRef = useRef(deviceToken)
  tokenRef.current = deviceToken
  const manifestRef = useRef<Manifest | null>(null)
  const statusRef = useRef<ManifestStatus>('idle')
  const inflightRef = useRef<Promise<void> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)

  const applyStatus = useCallback((next: ManifestStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const clearRetry = useCallback(() => {
    if (retryRef.current) {
      clearTimeout(retryRef.current)
      retryRef.current = null
    }
  }, [])

  const refetch = useCallback((): Promise<void> => {
    const token = tokenRef.current
    if (!token) return Promise.resolve()
    if (inflightRef.current) return inflightRef.current
    clearRetry()
    const run = (async () => {
      try {
        const fresh = await fetchManifest(token)
        if (!mountedRef.current || tokenRef.current !== token) return
        noteServerTime(fresh.generated_at)
        attemptRef.current = 0
        manifestRef.current = fresh
        setManifest(fresh)
        writeJson(MANIFEST_KEY, fresh)
        setLastFetchedAt(new Date())
        applyStatus('ready')
      } catch (e) {
        if (!mountedRef.current || tokenRef.current !== token) return
        if (e instanceof DeviceApiError && e.status === 401) {
          onUnauthorizedRef.current()
          return
        }
        console.warn('[player] manifest fetch failed', e)
        applyStatus('offline')
        const delay = nextDelay(attemptRef.current)
        attemptRef.current += 1
        retryRef.current = setTimeout(() => void refetch(), delay)
      } finally {
        inflightRef.current = null
      }
    })()
    inflightRef.current = run
    return run
  }, [applyStatus, clearRetry])

  // Token lifecycle: hydrate the cached manifest, then fetch fresh; idle when unpaired.
  useEffect(() => {
    if (!deviceToken) {
      clearRetry()
      inflightRef.current = null
      attemptRef.current = 0
      manifestRef.current = null
      setManifest(null)
      applyStatus('idle')
      return
    }
    const cached = readJson<unknown>(MANIFEST_KEY)
    if (isManifest(cached)) {
      manifestRef.current = cached
      setManifest(cached)
    }
    attemptRef.current = 0
    inflightRef.current = null
    applyStatus('loading')
    void refetch()
    return clearRetry
  }, [deviceToken, refetch, applyStatus, clearRetry])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 12h max-age refresh (60s check); skipped while offline — the retry loop already runs.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = manifestRef.current
      if (!tokenRef.current || !current || statusRef.current === 'offline') return
      const generated = Date.parse(current.generated_at)
      if (Number.isFinite(generated) && Date.now() - generated > MANIFEST_MAX_AGE_MS) void refetch()
    }, MAX_AGE_CHECK_MS)
    return () => clearInterval(timer)
  }, [refetch])

  return { manifest, status, refetch, lastFetchedAt }
}
