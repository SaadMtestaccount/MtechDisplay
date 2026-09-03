'use client'

/**
 * hooks/useRealtimeScreens.ts — the ONLY org-channel subscription in the admin app.
 * `useOrgRealtime(orgId)` is called once, by RealtimeBridge; everything else reads the
 * result through `useRealtimeScreens()` (RealtimeContext). docs/CONTRACTS.md §7/§8.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { CHANNEL_CONFIG, isOrgChangedPayload, isScreenStatusPayload, orgChannel } from '@/lib/channels'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase/client'
import type { RealtimeScreensValue, ScreenDetailView, ScreenStatusPayload, ScreenView } from '@/types/api'

export const RealtimeContext = createContext<RealtimeScreensValue>({ statuses: {}, connected: false })

/** Read the live statuses; merge into views with `mergeScreenStatus(screen, statuses[id], now)`. */
export function useRealtimeScreens(): RealtimeScreensValue {
  return useContext(RealtimeContext)
}

/** Leading-edge throttle with a trailing call so the last event in a burst still lands. */
function makeThrottle(fn: () => void, ms: number, timers: Set<ReturnType<typeof setTimeout>>) {
  let lastRun = 0
  let pending: ReturnType<typeof setTimeout> | null = null
  return () => {
    const elapsed = Date.now() - lastRun
    if (elapsed >= ms) {
      lastRun = Date.now()
      fn()
      return
    }
    if (pending) return
    pending = setTimeout(() => {
      timers.delete(pending!)
      pending = null
      lastRun = Date.now()
      fn()
    }, ms - elapsed)
    timers.add(pending)
  }
}

function isScreenViewArray(data: unknown): data is ScreenView[] {
  return Array.isArray(data)
}

/** Subscribes to org-{orgId} (private channel) and maintains statuses + query invalidation. */
export function useOrgRealtime(orgId: string | null): RealtimeScreensValue {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<string, ScreenStatusPayload>>({})
  const [connected, setConnected] = useState(false)
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses

  useEffect(() => {
    setStatuses({})
    setConnected(false)
    statusesRef.current = {}
    if (!orgId) return

    const supabase = createBrowserClient()
    let cancelled = false
    let channel: RealtimeChannel | null = null
    const timers = new Set<ReturnType<typeof setTimeout>>()

    const invalidateScreensList = makeThrottle(
      () => void queryClient.invalidateQueries({ queryKey: queryKeys.screens.all(orgId) }),
      5_000,
      timers,
    )
    const changedThrottles = new Map<string, () => void>()
    const invalidateChanged = (table: string) => {
      let throttled = changedThrottles.get(table)
      if (!throttled) {
        throttled = makeThrottle(() => {
          if (table === 'orgs') {
            void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() })
            router.refresh()
          } else {
            void queryClient.invalidateQueries({ queryKey: [table, orgId] })
          }
        }, 1_000, timers)
        changedThrottles.set(table, throttled)
      }
      throttled()
    }

    /** Previous current_item_id for a screen: last payload, else the cached detail/list row. */
    const previousItemId = (screenId: string): string | null | undefined => {
      const prev = statusesRef.current[screenId]
      if (prev) return prev.current_item_id
      const detail = queryClient.getQueryData<ScreenDetailView>(queryKeys.screens.detail(orgId, screenId))
      if (detail) return detail.current_item?.id ?? null
      for (const [key, data] of queryClient.getQueriesData({ queryKey: queryKeys.screens.all(orgId) })) {
        if (key[2] !== 'list' || !isScreenViewArray(data)) continue
        const row = data.find((s) => s.id === screenId)
        if (row) return row.current_item?.id ?? null
      }
      return undefined
    }

    const handleStatus = (payload: unknown) => {
      if (!isScreenStatusPayload(payload)) {
        console.warn('[realtime] ignoring malformed status payload', payload)
        return
      }
      const prevItem = previousItemId(payload.screen_id)
      setStatuses((prev) => ({ ...prev, [payload.screen_id]: payload }))
      if (prevItem !== undefined && payload.current_item_id !== prevItem) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.screens.detail(orgId, payload.screen_id) })
        invalidateScreensList()
      }
    }

    const handleChanged = (payload: unknown) => {
      if (!isOrgChangedPayload(payload)) {
        console.warn('[realtime] ignoring malformed changed payload', payload)
        return
      }
      invalidateChanged(payload.table)
    }

    void (async () => {
      // The private-channel join is refused without the user's JWT — set it before subscribing.
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase
        .channel(orgChannel(orgId), CHANNEL_CONFIG)
        .on('broadcast', { event: 'status' }, (message) => handleStatus((message as Record<string, unknown>).payload))
        .on('broadcast', { event: 'changed' }, (message) => handleChanged((message as Record<string, unknown>).payload))
        .subscribe((status) => {
          if (!cancelled) setConnected(status === 'SUBSCRIBED')
        })
    })()

    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      if (channel) void supabase.removeChannel(channel)
    }
  }, [orgId, queryClient, router])

  return { statuses, connected }
}
