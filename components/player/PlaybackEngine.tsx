'use client'

/**
 * components/player/PlaybackEngine.tsx — the playback loop (docs/CONTRACTS.md §10).
 * Active items = schedule (screen timezone) + expiry filter, re-evaluated on every advance and
 * every 30s. Two stacked layers give the 300ms fade crossfade with the next item pre-mounted
 * ('none' swaps instantly); images/websites advance after duration_seconds, videos on `ended`
 * (or the near-end signal, so the fade covers the finish) with a duration+1s safety timer; media
 * errors skip the item; websites are skipped while offline; standby when nothing is playable.
 * A lone video loops seamlessly. A manifest swap keeps the position by item id.
 * Synced playback (manifest.sync, §21): the shared server clock decides the slot instead of
 * free-running timers — every TV on the playlist shows the same item at the same offset.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { useMediaCache } from '@/hooks/useMediaCache'
import { syncedNow } from '@/lib/player/clock'
import { advanceDelayMs, isItemExpired, nextPlayable } from '@/lib/player/playback'
import { slotAt } from '@/lib/player/sync'
import { isItemActive } from '@/lib/schedule'
import type { Manifest, ManifestItem } from '@/types/api'
import { MediaLayer } from '@/components/player/MediaLayer'
import { StandbyScreen } from '@/components/player/StandbyScreen'
import { WebsiteLayer } from '@/components/player/WebsiteLayer'

const FADE_MS = 300
const PREMOUNT_MS = 60
const REEVALUATE_MS = 30_000
const ERROR_RETRY_MS = 30_000
const SYNC_SLACK_MS = 30

type Layer = { item: ManifestItem | null; src: string | null; nonce: number; syncStartMs: number | null }
const EMPTY_LAYER: Layer = { item: null, src: null, nonce: 0, syncStartMs: null }

function stopTimer(ref: MutableRefObject<ReturnType<typeof setTimeout> | null>): void {
  if (ref.current) {
    clearTimeout(ref.current)
    ref.current = null
  }
}

export function PlaybackEngine({
  manifest,
  cache,
  offline,
  timeZone,
  onCurrentItem,
}: {
  manifest: Manifest
  cache: ReturnType<typeof useMediaCache>
  offline: boolean
  timeZone: string
  onCurrentItem(itemId: string | null): void
}) {
  const [layers, setLayers] = useState<[Layer, Layer]>([EMPTY_LAYER, EMPTY_LAYER])
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0)
  const [fade, setFade] = useState(true)
  const [standby, setStandby] = useState(true)
  const [single, setSingle] = useState(false)

  const manifestRef = useRef(manifest)
  const timeZoneRef = useRef(timeZone)
  timeZoneRef.current = timeZone
  const cacheRef = useRef(cache)
  cacheRef.current = cache
  const offlineRef = useRef(offline)
  offlineRef.current = offline
  const onCurrentItemRef = useRef(onCurrentItem)
  onCurrentItemRef.current = onCurrentItem

  const currentRef = useRef<ManifestItem | null>(null)
  const activeIdxRef = useRef<0 | 1>(0)
  const nonceRef = useRef(0)
  const singleRef = useRef(false)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const erroredRef = useRef(new Map<string, number>())
  const advanceRef = useRef<() => void>(() => {})

  const isActiveNow = useCallback((item: ManifestItem, now: Date): boolean => {
    return isItemActive(item.schedule, now, timeZoneRef.current) && !isItemExpired(item, now)
  }, [])

  const canPlay = useCallback((item: ManifestItem): boolean => {
    const erroredAt = erroredRef.current.get(item.id)
    if (erroredAt !== undefined && Date.now() - erroredAt < ERROR_RETRY_MS) return false
    if (item.type === 'website') return !offlineRef.current
    return cacheRef.current.srcFor(item) !== null
  }, [])

  const setLayer = useCallback((idx: 0 | 1, layer: Layer) => {
    setLayers((prev) => (idx === 0 ? [layer, prev[1]] : [prev[0], layer]))
  }, [])

  const armAdvance = useCallback((item: ManifestItem) => {
    stopTimer(advanceTimerRef)
    advanceTimerRef.current = setTimeout(() => advanceRef.current(), advanceDelayMs(item))
  }, [])

  const markSingle = useCallback((count: number) => {
    singleRef.current = count === 1
    setSingle(count === 1)
  }, [])

  const goStandby = useCallback(() => {
    stopTimer(advanceTimerRef)
    stopTimer(swapTimerRef)
    stopTimer(clearTimerRef)
    currentRef.current = null
    onCurrentItemRef.current(null)
    setLayers([EMPTY_LAYER, EMPTY_LAYER])
    setStandby(true)
  }, [])

  /** Mounts `next` in the inactive layer, then crossfades (300ms) or swaps instantly. Callers arm timers. */
  const show = useCallback(
    (next: ManifestItem, syncStartMs: number | null) => {
      stopTimer(swapTimerRef)
      stopTimer(clearTimerRef)
      const incoming: 0 | 1 = activeIdxRef.current === 0 ? 1 : 0
      nonceRef.current += 1
      currentRef.current = next
      setStandby(false)
      onCurrentItemRef.current(next.id)
      setLayer(incoming, { item: next, src: cacheRef.current.srcFor(next), nonce: nonceRef.current, syncStartMs })
      const useFade = next.transition === 'fade'
      setFade(useFade)
      const activate = () => {
        activeIdxRef.current = incoming
        setActiveIdx(incoming)
        clearTimerRef.current = setTimeout(
          () => setLayer(incoming === 0 ? 1 : 0, EMPTY_LAYER),
          useFade ? FADE_MS + 100 : 50,
        )
      }
      if (useFade) swapTimerRef.current = setTimeout(activate, PREMOUNT_MS)
      else activate()
    },
    [setLayer],
  )

  /** Free-running mode: re-evaluate the active list and move to the next playable item (or standby). */
  const advance = useCallback(() => {
    stopTimer(advanceTimerRef)
    const now = new Date()
    const list = manifestRef.current.items.filter((item) => isActiveNow(item, now))
    markSingle(list.length)
    const current = currentRef.current
    const next = nextPlayable(list, current?.id ?? null, canPlay)
    if (!next) {
      goStandby()
      return
    }
    if (current && next.id === current.id) {
      // The only playable item repeats: images re-arm; videos loop on their own (MediaLayer `loop`).
      currentRef.current = next
      const idx = activeIdxRef.current
      setLayers((prev) => {
        const existing = prev[idx]
        if (!existing.item) return prev
        const updated: Layer = { ...existing, item: next }
        return idx === 0 ? [updated, prev[1]] : [prev[0], updated]
      })
      if (next.type !== 'video') armAdvance(next)
      return
    }
    show(next, null)
    armAdvance(next)
  }, [isActiveNow, canPlay, goStandby, show, armAdvance, markSingle])

  /** Synced mode: the shared clock picks the slot; the timer only wakes us at the next boundary. */
  const tickSync = useCallback(() => {
    stopTimer(advanceTimerRef)
    const nowMs = syncedNow()
    const list = manifestRef.current.items.filter((item) => isActiveNow(item, new Date(nowMs)))
    markSingle(list.length)
    const slot = slotAt(list, nowMs)
    if (!slot) {
      goStandby()
      return
    }
    const wake = () => {
      stopTimer(advanceTimerRef)
      advanceTimerRef.current = setTimeout(() => advanceRef.current(), slot.remainingMs + SYNC_SLACK_MS)
    }
    if (!canPlay(slot.item)) {
      // Hold the slot in standby so the phase stays shared; the next boundary re-evaluates.
      if (currentRef.current) goStandby()
      wake()
      return
    }
    if (currentRef.current?.id !== slot.item.id) show(slot.item, slot.startMs)
    wake()
  }, [isActiveNow, canPlay, goStandby, show, markSingle])
  advanceRef.current = manifestRef.current.sync ? tickSync : advance

  /** Interrupts only when the current item became invalid (or we are in standby). */
  const reconsider = useCallback(() => {
    const current = currentRef.current
    if (!current || manifestRef.current.sync) {
      advanceRef.current()
      return
    }
    const stillListed = manifestRef.current.items.some((item) => item.id === current.id)
    if (!stillListed || !isActiveNow(current, new Date()) || !canPlay(current)) advanceRef.current()
  }, [isActiveNow, canPlay])

  // Manifest swap: keep playing the same item id when it is still active and playable.
  useEffect(() => {
    manifestRef.current = manifest
    advanceRef.current = manifest.sync ? tickSync : advance
    const current = currentRef.current
    if (!current || manifest.sync) {
      advanceRef.current()
      return
    }
    const replacement = manifest.items.find((item) => item.id === current.id)
    if (replacement && isActiveNow(replacement, new Date()) && canPlay(replacement)) {
      currentRef.current = replacement
      const idx = activeIdxRef.current
      setLayers((prev) => {
        const existing = prev[idx]
        if (!existing.item) return prev
        const updated: Layer = { ...existing, item: replacement } // keep src — no restart
        return idx === 0 ? [updated, prev[1]] : [prev[0], updated]
      })
      if (replacement.type !== 'video' || !singleRef.current) armAdvance(replacement)
    } else {
      advanceRef.current()
    }
  }, [manifest, isActiveNow, canPlay, armAdvance, advance, tickSync])

  // Schedule boundaries and expirations: re-evaluate every 30s.
  useEffect(() => {
    const timer = setInterval(() => reconsider(), REEVALUATE_MS)
    return () => clearInterval(timer)
  }, [reconsider])

  // Offline flips: websites become skippable / playable again immediately.
  useEffect(() => {
    reconsider()
  }, [offline, reconsider])

  // Cache progress: leave standby as soon as something becomes playable.
  useEffect(() => {
    if (currentRef.current === null) reconsider()
  }, [cache, reconsider])

  useEffect(
    () => () => {
      stopTimer(advanceTimerRef)
      stopTimer(swapTimerRef)
      stopTimer(clearTimerRef)
    },
    [],
  )

  const handleEnded = useCallback((item: ManifestItem) => {
    if (currentRef.current?.id === item.id) advanceRef.current()
  }, [])

  /** Free-running only: start the next item ~0.35 s early so the crossfade hides the video's end. */
  const handleNearEnd = useCallback((item: ManifestItem) => {
    if (manifestRef.current.sync || singleRef.current) return
    if (currentRef.current?.id === item.id) advanceRef.current()
  }, [])

  const handleError = useCallback((item: ManifestItem) => {
    console.warn('[player] media error — skipping', item.name)
    erroredRef.current.set(item.id, Date.now())
    if (currentRef.current?.id === item.id) advanceRef.current()
  }, [])

  return (
    <div className="pl-fill pl-clip pl-black">
      {standby ? (
        <StandbyScreen
          orgName={manifest.org.name}
          logoUrl={manifest.org.logo_url}
          noContent={manifest.items.length === 0}
        />
      ) : null}
      {layers.map((layer, idx) => {
        const item = layer.item
        const isActive = idx === activeIdx && !standby
        return (
          <div
            key={idx}
            className="pl-fill"
            style={{
              opacity: isActive ? 1 : 0,
              transition: fade ? `opacity ${FADE_MS}ms ease-in-out` : 'none',
              zIndex: isActive ? 2 : 1,
            }}
          >
            {item === null ? null : item.type === 'website' ? (
              <WebsiteLayer key={`${item.id}:${layer.nonce}`} item={item} active={isActive} />
            ) : (
              <MediaLayer
                key={`${item.id}:${layer.nonce}`}
                item={item}
                src={layer.src}
                active={isActive}
                loop={single && item.type === 'video'}
                syncStartMs={layer.syncStartMs}
                onEnded={() => handleEnded(item)}
                onNearEnd={() => handleNearEnd(item)}
                onError={() => handleError(item)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
