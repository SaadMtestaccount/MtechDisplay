'use client'

/**
 * hooks/usePlayerPairing.ts — the whole unpaired flow (docs/CONTRACTS.md §8/§10).
 * Resumes `msign.pending` when its expires_at is in the future (a reload must not churn
 * the code), else requests a new code (decision §0.13: the raw device token arrives with
 * the code and only ever lives on the device). Polls pairing-status every 3s; a 404 means
 * the code is unknown/expired → discard and mint a new one; other errors back off 5s→60s.
 */
import { useEffect, useRef, useState } from 'react'
import { nextDelay } from '@/lib/player/backoff'
import { DeviceApiError, pollPairingStatus, requestPairingCode } from '@/lib/player/device-api'
import { PENDING_KEY, readJson, remove, writeJson } from '@/lib/player/player-storage'
import type { PendingPairingState, PlayerDeviceState } from '@/types/api'

const POLL_INTERVAL_MS = 3_000

function isPendingState(v: unknown): v is PendingPairingState {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return typeof p.code === 'string' && typeof p.device_token === 'string' && typeof p.expires_at === 'string'
}

export function usePlayerPairing(opts: {
  enabled: boolean
  fingerprint: string | null
  onPaired(state: PlayerDeviceState): void
}): { code: string | null; expiresAt: string | null; error: string | null } {
  const { enabled, fingerprint } = opts
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const onPairedRef = useRef(opts.onPaired)
  onPairedRef.current = opts.onPaired

  useEffect(() => {
    if (!enabled || !fingerprint) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms)
      })

    void (async () => {
      let pending = readJson<PendingPairingState>(PENDING_KEY)
      if (pending !== null && !(isPendingState(pending) && Date.parse(pending.expires_at) > Date.now())) {
        remove(PENDING_KEY)
        pending = null
      }
      let attempt = 0

      while (!cancelled) {
        if (!pending) {
          try {
            const res = await requestPairingCode(fingerprint)
            if (cancelled) return
            pending = { code: res.code, device_token: res.device_token, expires_at: res.expires_at }
            writeJson(PENDING_KEY, pending)
            attempt = 0
            setError(null)
          } catch (e) {
            if (cancelled) return
            console.warn('[player] pairing-code request failed', e)
            setError('Cannot reach the server. Retrying…')
            await sleep(nextDelay(attempt))
            attempt += 1
            continue
          }
        }

        setCode(pending.code)
        setExpiresAt(pending.expires_at)

        try {
          const status = await pollPairingStatus(pending.code, fingerprint)
          if (cancelled) return
          attempt = 0
          setError(null)
          if (status.claimed) {
            const state: PlayerDeviceState = { device_token: pending.device_token, screen_id: status.screen_id }
            remove(PENDING_KEY)
            onPairedRef.current(state)
            return
          }
          setExpiresAt(status.expires_at)
          await sleep(POLL_INTERVAL_MS)
        } catch (e) {
          if (cancelled) return
          if (e instanceof DeviceApiError && e.status === 404) {
            // Unknown or expired code — the server decides; mint a fresh one.
            remove(PENDING_KEY)
            pending = null
            setCode(null)
            setExpiresAt(null)
            continue
          }
          console.warn('[player] pairing-status poll failed', e)
          setError('Connection problem. Retrying…')
          await sleep(nextDelay(attempt))
          attempt += 1
        }
      }
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, fingerprint])

  return { code, expiresAt, error }
}
