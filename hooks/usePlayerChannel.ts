'use client'

/**
 * hooks/usePlayerChannel.ts — the player's ONLY realtime subscription (docs/CONTRACTS.md
 * §7, §8): the private `screen-{id}` channel. Payloads are narrowed with
 * isScreenCommandPayload and console.warn'd + ignored otherwise; `sync`/`identify` are
 * coalesced to one per second and `reload` to one per 30s. A SUBSCRIBED that follows a
 * CHANNEL_ERROR/TIMED_OUT/CLOSED fires onReconnect (the app refetches the manifest).
 */
import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { CHANNEL_CONFIG, isScreenCommandPayload, screenChannel } from '@/lib/channels'
import { createBrowserClient } from '@/lib/supabase/client'

const SYNC_GAP_MS = 1_000
const IDENTIFY_GAP_MS = 1_000
const RELOAD_GAP_MS = 30_000

export function usePlayerChannel(opts: {
  screenId: string | null
  onSync(): void
  onReload(): void
  onIdentify(): void
  onUnpair(): void
  onReconnect(): void
}): { connected: boolean } {
  const { screenId } = opts
  const [connected, setConnected] = useState(false)

  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    setConnected(false)
    if (!screenId) return

    const supabase = createBrowserClient()
    let cancelled = false
    let channel: RealtimeChannel | null = null
    let wasDisrupted = false
    const lastAt: Record<string, number> = {}

    const onCommand = (event: string, gapMs: number, payload: unknown, run: () => void) => {
      if (!isScreenCommandPayload(payload)) {
        console.warn('[player] ignoring malformed command payload', event, payload)
        return
      }
      const now = Date.now()
      if (gapMs > 0 && now - (lastAt[event] ?? 0) < gapMs) return
      lastAt[event] = now
      run()
    }

    void (async () => {
      // Private-channel joins carry the client's token (anon key for the player).
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase
        .channel(screenChannel(screenId), CHANNEL_CONFIG)
        .on('broadcast', { event: 'sync' }, (message) =>
          onCommand('sync', SYNC_GAP_MS, (message as Record<string, unknown>).payload, () => optsRef.current.onSync()),
        )
        .on('broadcast', { event: 'reload' }, (message) =>
          onCommand('reload', RELOAD_GAP_MS, (message as Record<string, unknown>).payload, () => optsRef.current.onReload()),
        )
        .on('broadcast', { event: 'identify' }, (message) =>
          onCommand('identify', IDENTIFY_GAP_MS, (message as Record<string, unknown>).payload, () => optsRef.current.onIdentify()),
        )
        .on('broadcast', { event: 'unpair' }, (message) =>
          onCommand('unpair', 0, (message as Record<string, unknown>).payload, () => optsRef.current.onUnpair()),
        )
        .subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            setConnected(true)
            if (wasDisrupted) {
              wasDisrupted = false
              optsRef.current.onReconnect()
            }
          } else {
            wasDisrupted = true
            setConnected(false)
          }
        })
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [screenId])

  return { connected }
}
