'use client'

/**
 * hooks/usePlayerChannel.ts — the player's ONLY realtime subscription (docs/CONTRACTS.md
 * §7, §8): the private `screen-{id}` channel, implemented in lib/player/realtime.ts. That module
 * (and the Supabase client with it) is loaded with a dynamic import only on engines that can
 * parse it (§20): old TV browsers skip realtime and rely on the 30 s heartbeat — content still
 * updates, just not instantly, and a 401 on the heartbeat still unpairs.
 */
import { useEffect, useRef, useState } from 'react'
import { supportsModernSyntax } from '@/lib/player/engine'
import type { PlayerChannelHandlers } from '@/lib/player/realtime'

export function usePlayerChannel(opts: { screenId: string | null } & PlayerChannelHandlers): { connected: boolean } {
  const { screenId } = opts
  const [connected, setConnected] = useState(false)

  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    setConnected(false)
    if (!screenId) return
    if (!supportsModernSyntax()) {
      console.warn('[player] realtime disabled on this engine — updates arrive with the heartbeat')
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | null = null
    import('@/lib/player/realtime')
      .then((mod) => {
        if (cancelled) return
        unsubscribe = mod.subscribePlayerChannel(screenId, () => optsRef.current, setConnected)
      })
      .catch((e) => console.warn('[player] realtime unavailable — updates arrive with the heartbeat', e))

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [screenId])

  return { connected }
}
