'use client'

/**
 * hooks/useHeartbeat.ts — the player's 30s heartbeat loop (docs/CONTRACTS.md §8, §10).
 * `failing` is the player's offline signal (decision §0.15): a failure = network error /
 * timeout / HTTP ≥ 500 (never 401/4xx); `failing = consecutiveFailures >= 2`. After a
 * failure the next beat is scheduled with nextDelay(consecutiveFailures − 1) (5s→60s)
 * instead of 30s; any 2xx resets the counter and restores the 30s cadence.
 */
import { useEffect, useRef, useState } from 'react'
import { nextDelay } from '@/lib/player/backoff'
import { DeviceApiError, sendHeartbeat } from '@/lib/player/device-api'
import { HEARTBEAT_INTERVAL_MS } from '@/lib/status'
import type { HeartbeatRequest } from '@/types/api'

export function useHeartbeat(opts: {
  enabled: boolean
  deviceToken: string | null
  getState(): HeartbeatRequest
  onVersionMismatch(serverVersion: number): void
  onUnauthorized(): void
  onResult?(ok: boolean): void
}): { lastOkAt: Date | null; failing: boolean } {
  const { enabled, deviceToken } = opts
  const [lastOkAt, setLastOkAt] = useState<Date | null>(null)
  const [failing, setFailing] = useState(false)

  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!enabled || !deviceToken) {
      setFailing(false)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let consecutiveFailures = 0

    const schedule = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(() => void beat(), ms)
    }

    const beat = async () => {
      const body = optsRef.current.getState()
      try {
        const res = await sendHeartbeat(deviceToken, body)
        if (cancelled) return
        consecutiveFailures = 0
        setFailing(false)
        setLastOkAt(new Date())
        optsRef.current.onResult?.(true)
        if (res.playlist_version !== body.playlist_version) {
          optsRef.current.onVersionMismatch(res.playlist_version)
        }
        schedule(HEARTBEAT_INTERVAL_MS)
      } catch (e) {
        if (cancelled) return
        if (e instanceof DeviceApiError && e.status === 401) {
          optsRef.current.onResult?.(false)
          optsRef.current.onUnauthorized()
          return // the app wipes and re-enters pairing; this loop is done
        }
        const isFailure = !(e instanceof DeviceApiError) || e.status === 0 || e.status >= 500
        optsRef.current.onResult?.(false)
        if (isFailure) {
          consecutiveFailures += 1
          setFailing(consecutiveFailures >= 2)
          schedule(nextDelay(consecutiveFailures - 1))
        } else {
          // other 4xx: never a failure — keep the normal cadence
          console.warn('[player] heartbeat rejected', e)
          schedule(HEARTBEAT_INTERVAL_MS)
        }
      }
    }

    void beat() // first beat immediately when enabled

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, deviceToken])

  return { lastOkAt, failing }
}
