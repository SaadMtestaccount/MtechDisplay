'use client'

/**
 * lib/player/realtime.ts — BROWSER ONLY. The player's realtime subscription to its private
 * `screen-{id}` channel (docs/CONTRACTS.md §7, §8), split out of usePlayerChannel so the Supabase
 * client is loaded with a dynamic import only on engines that can parse it (§20). Payloads are
 * narrowed with isScreenCommandPayload and console.warn'd + ignored otherwise; `sync`/`identify`
 * are coalesced to one per second and `reload` to one per 30s. A SUBSCRIBED that follows a
 * CHANNEL_ERROR/TIMED_OUT/CLOSED reports a reconnect (the app refetches the manifest).
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { CHANNEL_CONFIG, isScreenCommandPayload, screenChannel } from '@/lib/channels'
import { createBrowserClient } from '@/lib/supabase/client'

const SYNC_GAP_MS = 1_000
const IDENTIFY_GAP_MS = 1_000
const RELOAD_GAP_MS = 30_000

export type PlayerChannelHandlers = {
  onSync(): void
  onReload(): void
  onIdentify(): void
  onUnpair(): void
  onReconnect(): void
}

/** Subscribes and returns the unsubscribe function. `handlers()` is read at event time. */
export function subscribePlayerChannel(
  screenId: string,
  handlers: () => PlayerChannelHandlers,
  onConnected: (connected: boolean) => void,
): () => void {
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
  const payloadOf = (message: unknown) => (message as Record<string, unknown>).payload

  void (async () => {
    // Private-channel joins carry the client's token (anon key for the player).
    await supabase.realtime.setAuth()
    if (cancelled) return
    channel = supabase
      .channel(screenChannel(screenId), CHANNEL_CONFIG)
      .on('broadcast', { event: 'sync' }, (m) => onCommand('sync', SYNC_GAP_MS, payloadOf(m), () => handlers().onSync()))
      .on('broadcast', { event: 'reload' }, (m) => onCommand('reload', RELOAD_GAP_MS, payloadOf(m), () => handlers().onReload()))
      .on('broadcast', { event: 'identify' }, (m) =>
        onCommand('identify', IDENTIFY_GAP_MS, payloadOf(m), () => handlers().onIdentify()),
      )
      .on('broadcast', { event: 'unpair' }, (m) => onCommand('unpair', 0, payloadOf(m), () => handlers().onUnpair()))
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          onConnected(true)
          if (wasDisrupted) {
            wasDisrupted = false
            handlers().onReconnect()
          }
        } else {
          wasDisrupted = true
          onConnected(false)
        }
      })
  })()

  return () => {
    cancelled = true
    if (channel) void supabase.removeChannel(channel)
  }
}
